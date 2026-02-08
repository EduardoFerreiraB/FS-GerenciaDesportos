import os
import sys
import subprocess
from sqlalchemy import create_engine, text

# Adiciona o diretório app ao path para permitir imports
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

def install_dependencies():
    print("\n--- 1. Instalando Dependências ---")
    
    # Backend
    print("📦 Instalando dependências do Backend (Python)...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Dependências do Backend instaladas.")
    except Exception as e:
        print(f"❌ Erro ao instalar dependências do Backend: {e}")
    
    # Frontend
    print("\n📦 Instalando dependências do Frontend (Node.js)...")
    frontend_path = os.path.join(os.path.dirname(__file__), 'frontend')
    if os.path.exists(frontend_path):
        try:
            # Verifica se npm está disponível
            subprocess.check_call(["npm", "--version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            subprocess.check_call(["npm", "install"], cwd=frontend_path)
            print("✅ Dependências do Frontend instaladas.")
        except FileNotFoundError:
            print("⚠️  AVISO: 'npm' não encontrado. Pulando instalação do Frontend.")
            print("Certifique-se de ter o Node.js instalado para rodar o dashboard.")
        except Exception as e:
            print(f"❌ Erro ao instalar dependências do Frontend: {e}")
    else:
        print("⚠️  AVISO: Pasta 'frontend' não encontrada.")

def setup_database():
    print("\n--- 2. Configuração do Banco de Dados MySQL ---")
    db_user = input("Usuário do MySQL (padrão: root): ") or "root"
    db_pass = input(f"Senha do MySQL para '{db_user}': ")
    db_host = input("Host do MySQL (padrão: localhost): ") or "localhost"
    db_port = input("Porta do MySQL (padrão: 3306): ") or "3306"
    db_name = input("Nome do Banco de Dados a ser criado (padrão: gerencia_esporte_local): ") or "gerencia_esporte_local"

    # Conecta ao servidor para criar o banco
    server_url = f"mysql+pymysql://{db_user}:{db_pass}@{db_host}:{db_port}"
    
    try:
        engine = create_engine(server_url)
        with engine.connect() as conn:
            conn.execute(text(f"CREATE DATABASE IF NOT EXISTS {db_name}"))
            conn.execute(text("COMMIT"))
            print(f"✅ Banco de dados '{db_name}' pronto.")
    except Exception as e:
        print(f"\n❌ ERRO: Não foi possível conectar ao MySQL.")
        print(f"Detalhe: {e}")
        sys.exit(1)

    db_url = f"mysql+pymysql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"
    return db_url

def create_env_file(db_url):
    print("\n--- 3. Criando arquivo .env ---")
    env_content = f"""DATABASE_URL={db_url}
SECRET_KEY=dev_secret_key_change_me_in_production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
"""
    with open(".env", "w") as f:
        f.write(env_content)
    print("✅ Arquivo .env criado com sucesso.")

def create_admin():
    print("\n--- 4. Criando Usuário Administrador ---")
    print("Isso também criará as tabelas no banco de dados automaticamente.")
    os.system(f"{sys.executable} create_admin.py")

if __name__ == "__main__":
    print("==================================================")
    print("   BEM-VINDO AO SETUP DO GERENCIA ESPORTE")
    print("==================================================")
    
    install_dependencies()
    url = setup_database()
    create_env_file(url)
    create_admin()

    print("\n==================================================")
    print("   🎉 TUDO PRONTO PARA COMEÇAR!")
    print("==================================================")
    print("\nCOMO RODAR O PROJETO:")
    print("\nBasta rodar o comando abaixo para iniciar")
    print("Backend e Frontend simultaneamente:")
    print("\n   python dev.py")
    print("\n==================================================")