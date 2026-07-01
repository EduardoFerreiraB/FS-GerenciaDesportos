import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os
from unittest.mock import MagicMock

# Adiciona o diretório 'app' ao PYTHONPATH
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'app')))

import models
from database import Base, get_db
from main import app

# Configura o SQLite para rodar testes locais isolados
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    # Garante tabelas limpas a cada teste
    Base.metadata.create_all(bind=engine)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

class MockQuery:
    def __init__(self, items, session=None, model=None):
        self.items = items
        self.session = session
        self.model = model
        if self.session and self.items:
            for item in self.items:
                self.session._resolve_secondary_relationships(item)

    def _evaluate_criterion(self, item, criterion):
        op = getattr(criterion, 'operator', None)
        op_name = getattr(op, '__name__', '') if op else ''
        
        if op_name in ("or_", "and_"):
            clauses = getattr(criterion, 'clauses', None)
            if clauses is not None:
                vals = [self._evaluate_criterion(item, clause) for clause in clauses]
                if op_name == "or_":
                    return any(vals)
                else:
                    return all(vals)
            else:
                left_val = self._evaluate_criterion(item, criterion.left)
                right_val = self._evaluate_criterion(item, criterion.right)
                if op_name == "or_":
                    return left_val or right_val
                else:
                    return left_val and right_val
                
        if hasattr(criterion, 'left') and hasattr(criterion, 'right'):
            col = criterion.left
            col_class = getattr(getattr(col, 'parent', None), 'class_', None)
            
            if col_class is None:
                col_table = getattr(col, 'table', None)
                if col_table is not None:
                    table_name = getattr(col_table, 'name', str(col_table))
                    for c in [models.Usuario, models.RefreshToken, models.Professor, models.Turma, 
                              models.TurmaDia, models.Aluno, models.Matricula, models.Presenca, 
                              models.Evento, models.Edicao, models.Equipe, models.Partida, 
                              models.Local, models.Arbitro]:
                        if getattr(c, '__tablename__', None) == table_name:
                            col_class = c
                            break
            
            if col_class is not None and col_class != item.__class__:
                return self._evaluate_criterion_recursive(item, col_class, criterion)
                
            return self._evaluate_leaf_criterion(item, criterion)
        return True

    def _evaluate_criterion_recursive(self, item, target_class, criterion, visited=None):
        if visited is None:
            visited = set()
            
        if item.__class__ == target_class:
            return self._evaluate_leaf_criterion(item, criterion)
            
        item_class = item.__class__
        if item_class in visited:
            return False
        visited.add(item_class)
        
        mapper = getattr(item_class, '__mapper__', None)
        if mapper is not None:
            for rel in mapper.relationships.values():
                rel_class = rel.mapper.class_
                if rel_class in visited:
                    continue
                rel_val = getattr(item, rel.key, None)
                if rel_val is not None:
                    if isinstance(rel_val, list):
                        if any(self._evaluate_criterion_recursive(sub, target_class, criterion, visited.copy()) for sub in rel_val):
                            return True
                    else:
                        if self._evaluate_criterion_recursive(rel_val, target_class, criterion, visited.copy()):
                            return True
        return False

    def _evaluate_leaf_criterion(self, item, criterion):
        col = criterion.left
        col_name = getattr(col, 'name', None)
        if col_name is None:
            return True
        val = getattr(criterion.right, 'value', None)
        if val is None:
            val = criterion.right
        
        if hasattr(val, 'value'):
            val = val.value
            
        item_val = getattr(item, col_name, None)
        leaf_op = getattr(criterion.operator, '__name__', '')
        if leaf_op == "eq":
            return item_val == val
        elif leaf_op == "ne":
            return item_val != val
        elif leaf_op == "lt":
            return item_val < val
        elif leaf_op == "gt":
            return item_val > val
        elif leaf_op == "le":
            return item_val <= val
        elif leaf_op == "ge":
            return item_val >= val
        elif leaf_op == "in_op":
            return item_val in val
        elif leaf_op == "notin_op":
            return item_val not in val
        return True

    def filter(self, *criteria):
        filtered_items = list(self.items)
        for criterion in criteria:
            try:
                filtered_items = [x for x in filtered_items if self._evaluate_criterion(x, criterion)]
            except Exception:
                pass
        return MockQuery(filtered_items, self.session, self.model)

    def offset(self, val):
        return MockQuery(self.items[val:], self.session, self.model)

    def limit(self, val):
        return MockQuery(self.items[:val], self.session, self.model)

    def order_by(self, *args):
        return self

    def distinct(self, *args, **kwargs):
        return self

    def options(self, *args, **kwargs):
        return self

    def execution_options(self, *args, **kwargs):
        return self

    def join(self, *args, **kwargs):
        return self

    def all(self):
        return self.items

    def first(self):
        return self.items[0] if self.items else None

    def delete(self, synchronize_session=False):
        count = len(self.items)
        if self.session:
            for item in list(self.items):
                self.session.delete(item)
        return count

class MockSession:
    def __init__(self):
        self.objects = {}
        self.deleted_objects = []
        self.snapshot = {}
        self.association_data = {}
        self.relationships = {
            (models.RefreshToken, 'usuario'): (models.Usuario, 'id_usuario', 'id_usuario'),
            (models.Professor, 'usuario'): (models.Usuario, 'id_usuario', 'id_usuario'),
            (models.Turma, 'professor'): (models.Professor, 'id_professor', 'id_professor'),
            (models.Turma, 'modalidade'): (models.Modalidade, 'id_modalidade', 'id_modalidade'),
            (models.Matricula, 'aluno'): (models.Aluno, 'id_aluno', 'id_aluno'),
            (models.Matricula, 'turma'): (models.Turma, 'id_turma', 'id_turma'),
            (models.Presenca, 'aluno'): (models.Aluno, 'id_aluno', 'id_aluno'),
            (models.Presenca, 'turma'): (models.Turma, 'id_turma', 'id_turma'),
            (models.Edicao, 'evento'): (models.Evento, 'id_evento', 'id_evento'),
            (models.Equipe, 'edicao'): (models.Edicao, 'id_edicao', 'id_edicao'),
            (models.Partida, 'edicao'): (models.Edicao, 'id_edicao', 'id_edicao'),
            (models.Partida, 'local'): (models.Local, 'id_local', 'id_local'),
            (models.Partida, 'arbitro'): (models.Arbitro, 'id_arbitro', 'id_arbitro'),
            (models.Partida, 'equipe_casa'): (models.Equipe, 'id_equipe_casa', 'id_equipe'),
            (models.Partida, 'equipe_visitante'): (models.Equipe, 'id_equipe_visitante', 'id_equipe'),
            (models.TurmaDia, 'turma'): (models.Turma, 'id_turma', 'id_turma'),
            (models.Aluno, 'participante'): (models.Participante, 'id_participante', 'id_participante'),
            (models.Atleta, 'participante'): (models.Participante, 'id_participante', 'id_participante'),
        }

    def _resolve_relationships(self, obj):
        model_class = obj.__class__
        mapper = getattr(model_class, '__mapper__', None)
        for (src_class, attr), (target_class, fk_attr, pk_attr) in self.relationships.items():
            if src_class == model_class:
                fk_val = getattr(obj, fk_attr, None)
                if fk_val is not None:
                    targets = self.objects.get(target_class, [])
                    target_obj = next((t for t in targets if getattr(t, pk_attr, None) == fk_val), None)
                    if target_obj is not None:
                        setattr(obj, attr, target_obj)
                        
                        if mapper is not None and attr in mapper.relationships:
                            rel = mapper.relationships[attr]
                            back_attr = rel.back_populates
                            if back_attr:
                                collection = getattr(target_obj, back_attr, None)
                                if isinstance(collection, list):
                                    if obj not in collection:
                                        collection.append(obj)
                                elif collection is None:
                                    target_mapper = getattr(target_class, '__mapper__', None)
                                    if target_mapper and back_attr in target_mapper.relationships:
                                        target_rel = target_mapper.relationships[back_attr]
                                        if target_rel.uselist:
                                            setattr(target_obj, back_attr, [obj])
                                        else:
                                            setattr(target_obj, back_attr, obj)

    def _apply_defaults(self, obj):
        mapper = getattr(obj.__class__, '__mapper__', None)
        if mapper is not None:
            for col in mapper.columns:
                val = getattr(obj, col.name, None)
                if val is None and col.default is not None:
                    if hasattr(col.default, 'arg'):
                        if callable(col.default.arg):
                            try:
                                setattr(obj, col.name, col.default.arg())
                            except TypeError:
                                try:
                                    setattr(obj, col.name, col.default.arg(None))
                                except Exception:
                                    pass
                        else:
                            setattr(obj, col.name, col.default.arg)

    def add(self, obj):
        model_class = obj.__class__
        if model_class not in self.objects:
            self.objects[model_class] = []
        if obj not in self.objects[model_class]:
            self.objects[model_class].append(obj)
        self._assign_id(obj)
        self._apply_defaults(obj)
        self._resolve_relationships(obj)

    def add_all(self, objs):
        for obj in objs:
            self.add(obj)

    def commit(self):
        self.flush()
        self._take_snapshot()

    def rollback(self):
        for model_class, states in self.snapshot.items():
            current_ids = {id(o) for o in self.objects.get(model_class, [])}
            for obj_id, obj, state in states:
                if obj_id not in current_ids:
                    if model_class not in self.objects:
                        self.objects[model_class] = []
                    self.objects[model_class].append(obj)
                for attr, val in state.items():
                    try:
                        setattr(obj, attr, val)
                    except AttributeError:
                        pass
            snapshot_ids = {item[0] for item in states}
            if model_class in self.objects:
                self.objects[model_class] = [o for o in self.objects[model_class] if id(o) in snapshot_ids]
        self.deleted_objects.clear()

    def _take_snapshot(self):
        self.snapshot = {}
        for model_class, objs in self.objects.items():
            self.snapshot[model_class] = []
            for obj in objs:
                state = {}
                for attr in dir(obj):
                    if attr.startswith('_') or attr == 'metadata':
                        continue
                    val = getattr(obj, attr, None)
                    if isinstance(val, list):
                        mapper = getattr(obj.__class__, '__mapper__', None)
                        if mapper is not None and attr in mapper.relationships:
                            rel = mapper.relationships[attr]
                            if rel.secondary is not None:
                                target_pk = rel.mapper.primary_key[0].name
                                state[attr] = [getattr(item, target_pk) for item in val if getattr(item, target_pk) is not None]
                    else:
                        if not hasattr(val, '__class__') or not hasattr(val.__class__, '__mapper__'):
                            state[attr] = val
                self.snapshot[model_class].append((id(obj), obj, state))

    def flush(self):
        # 1. Collect all reachable child objects via relationship attributes
        reachable_objects = []
        for model_class, objs in list(self.objects.items()):
            for obj in objs:
                for attr in dir(obj):
                    if attr.startswith('_'):
                        continue
                    val = getattr(obj, attr, None)
                    if isinstance(val, list):
                        for item in val:
                            if hasattr(item, '__class__') and hasattr(item.__class__, '__mapper__'):
                                reachable_objects.append(item)
                    elif hasattr(val, '__class__') and hasattr(val.__class__, '__mapper__'):
                        reachable_objects.append(val)
        
        # Add any reachable objects that are not yet in self.objects
        for item in reachable_objects:
            iclass = item.__class__
            if iclass not in self.objects:
                self.objects[iclass] = []
            if item not in self.objects[iclass] and item not in self.deleted_objects:
                self.objects[iclass].append(item)

        # 2. Clean up disassociated orphans
        for (src_class, attr), (target_class, fk_attr, pk_attr) in list(self.relationships.items()):
            mapper = getattr(src_class, '__mapper__', None)
            if mapper is not None and attr in mapper.relationships:
                rel = mapper.relationships[attr]
                back_attr = rel.back_populates
                if back_attr:
                    for obj in list(self.objects.get(src_class, [])):
                        fk_val = getattr(obj, fk_attr, None)
                        if fk_val is not None:
                            parents = self.objects.get(target_class, [])
                            parent = next((p for p in parents if getattr(p, pk_attr, None) == fk_val), None)
                            if parent is not None:
                                collection = getattr(parent, back_attr, None)
                                if isinstance(collection, list) and obj not in collection:
                                    target_mapper = getattr(target_class, '__mapper__', None)
                                    target_rel = target_mapper.relationships[back_attr] if target_mapper else None
                                    if target_rel and "delete-orphan" in getattr(target_rel, 'cascade', ''):
                                        if obj in self.objects[src_class]:
                                            self.objects[src_class].remove(obj)
                                            self.deleted_objects.append(obj)
                                    else:
                                        setattr(obj, fk_attr, None)
                                        setattr(obj, attr, None)

        # 3. Process IDs, defaults, and relationships
        for model_class, objs in self.objects.items():
            for obj in objs:
                self._assign_id(obj)
        for model_class, objs in self.objects.items():
            for obj in objs:
                mapper = getattr(obj.__class__, '__mapper__', None)
                if mapper is not None:
                    for attr_name, rel in mapper.relationships.items():
                        if rel.secondary is not None:
                            if attr_name not in obj.__dict__:
                                self._resolve_secondary_relationship_attr(obj, attr_name, rel)
        for model_class, objs in self.objects.items():
            for obj in objs:
                self._sync_secondary_relationships(obj)
        for model_class, objs in self.objects.items():
            for obj in objs:
                self._apply_defaults(obj)
        for model_class, objs in self.objects.items():
            for obj in objs:
                self._resolve_relationships(obj)
                self._resolve_secondary_relationships(obj)

    def _sync_secondary_relationships(self, obj):
        model_class = obj.__class__
        mapper = getattr(model_class, '__mapper__', None)
        if mapper is not None:
            for attr_name, rel in mapper.relationships.items():
                if rel.secondary is not None:
                    if attr_name in obj.__dict__:
                        related_list = getattr(obj, attr_name, None)
                        if isinstance(related_list, list):
                            target_pk_name = rel.mapper.primary_key[0].name
                            current_ids = [getattr(item, target_pk_name) for item in related_list if getattr(item, target_pk_name) is not None]
                            
                            obj_snapshot = None
                            if model_class in self.snapshot:
                                for oid, o, ostate in self.snapshot[model_class]:
                                    if o is obj:
                                        obj_snapshot = ostate
                                        break
                                        
                            changed = False
                            if obj_snapshot is None or attr_name not in obj_snapshot:
                                changed = True
                            else:
                                if current_ids != obj_snapshot[attr_name]:
                                    changed = True
                                    
                            if not changed:
                                continue
                                
                            sec_table_name = rel.secondary.name
                            if sec_table_name not in self.association_data:
                                self.association_data[sec_table_name] = []
                            pk_name = mapper.primary_key[0].name
                            local_id = getattr(obj, pk_name, None)
                            if local_id is not None:
                                self.association_data[sec_table_name] = [
                                    row for row in self.association_data[sec_table_name]
                                    if row.get(pk_name) != local_id
                                ]
                                for target_obj in related_list:
                                    target_id = getattr(target_obj, target_pk_name, None)
                                    if target_id is not None:
                                        self.association_data[sec_table_name].append({
                                            pk_name: local_id,
                                            target_pk_name: target_id
                                        })

    def _resolve_secondary_relationship_attr(self, obj, attr_name, rel):
        sec_table_name = rel.secondary.name
        rows = self.association_data.get(sec_table_name, [])
        mapper = obj.__class__.__mapper__
        pk_name = mapper.primary_key[0].name
        target_pk_name = rel.mapper.primary_key[0].name
        
        matching_ids = []
        for row in rows:
            if row.get(pk_name) == getattr(obj, pk_name):
                matching_ids.append(row.get(target_pk_name))
                
        target_class = rel.mapper.class_
        target_objects = self.objects.get(target_class, [])
        linked_objects = [t for t in target_objects if getattr(t, target_pk_name) in matching_ids]
        setattr(obj, attr_name, linked_objects)

    def _resolve_secondary_relationships(self, obj):
        mapper = getattr(obj.__class__, '__mapper__', None)
        if mapper is not None:
            for attr_name, rel in mapper.relationships.items():
                if rel.secondary is not None:
                    self._resolve_secondary_relationship_attr(obj, attr_name, rel)

    def refresh(self, obj):
        pass

    def expire_all(self):
        self.rollback()

    def delete(self, obj):
        model_class = obj.__class__
        if model_class in self.objects and obj in self.objects[model_class]:
            self.objects[model_class].remove(obj)
            self.deleted_objects.append(obj)
            
            mapper = getattr(model_class, '__mapper__', None)
            if mapper is not None:
                for attr, rel in mapper.relationships.items():
                    target = getattr(obj, attr, None)
                    if target is not None:
                        back_attr = rel.back_populates
                        if back_attr:
                            collection = getattr(target, back_attr, None)
                            if isinstance(collection, list) and obj in collection:
                                collection.remove(obj)
                            elif collection == obj:
                                setattr(target, back_attr, None)

    def _assign_id(self, obj):
        mapper = getattr(obj.__class__, '__mapper__', None)
        if mapper is not None:
            for col in mapper.primary_key:
                attr = col.name
                if getattr(obj, attr, None) is None:
                    model_class = obj.__class__
                    existing_ids = [getattr(x, attr) for x in self.objects.get(model_class, []) if getattr(x, attr) is not None]
                    next_id = max(existing_ids) + 1 if existing_ids else 1
                    setattr(obj, attr, next_id)

    def query(self, model):
        if model not in self.objects:
            self.objects[model] = []
        return MockQuery(self.objects[model], session=self, model=model)

    def execute(self, statement, *args, **kwargs):
        stmt_type = statement.__class__.__name__.lower()
        
        table_name = None
        if hasattr(statement, 'table'):
            table_name = statement.table.name
        elif hasattr(statement, 'get_final_froms'):
            froms = statement.get_final_froms()
            if froms:
                table_name = froms[0].name
                
        if table_name is None:
            res = MagicMock()
            res.scalars.return_value.all.return_value = []
            res.first.return_value = None
            return res
            
        if table_name not in self.association_data:
            self.association_data[table_name] = []
            
        params = statement.compile().params
        
        if "insert" in stmt_type:
            self.association_data[table_name].append(params)
            res = MagicMock()
            return res
            
        elif "delete" in stmt_type:
            filter_cols = {}
            for param_key, param_val in params.items():
                base_col = param_key.rsplit('_', 1)[0]
                filter_cols[base_col] = param_val
                
            self.association_data[table_name] = [
                row for row in self.association_data[table_name]
                if not all(row.get(k) == v for k, v in filter_cols.items())
            ]
            res = MagicMock()
            return res
            
        elif "select" in stmt_type:
            filter_cols = {}
            for param_key, param_val in params.items():
                base_col = param_key.rsplit('_', 1)[0]
                filter_cols[base_col] = param_val
                
            matching_rows = []
            for row in self.association_data[table_name]:
                match = True
                for k, v in filter_cols.items():
                    row_val = row.get(k)
                    if isinstance(v, list):
                        if row_val not in v:
                            match = False
                            break
                    else:
                        if row_val != v:
                            match = False
                            break
                if match:
                    matching_rows.append(row)
                    
            res = MagicMock()
            res.first.return_value = matching_rows[0] if matching_rows else None
            res.scalars.return_value.all.return_value = matching_rows
            return res
            
        res = MagicMock()
        res.scalars.return_value.all.return_value = []
        res.first.return_value = None
        return res

@pytest.fixture(scope="function")
def mock_db():
    return MockSession()

@pytest.fixture(scope="function")
def mock_client(mock_db):
    def override_get_db():
        yield mock_db
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

