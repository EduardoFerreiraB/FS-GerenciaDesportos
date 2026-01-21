import api from '@/lib/api';

export const alunoService = {
  getAll: async () => {
    const response = await api.get('/alunos');
    return response.data;
  },
  getById: async (id: number) => {
    const response = await api.get(`/alunos/${id}`);
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/alunos', data);
    return response.data;
  },
  update: async (id: number, data: any) => {
    const response = await api.put(`/alunos/${id}`, data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/alunos/${id}`);
    return response.data;
  }
};

export const professorService = {
  getAll: async () => {
    const response = await api.get('/professores');
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/professores', data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/professores/${id}`);
    return response.data;
  }
};

export const modalidadeService = {
  getAll: async () => {
    const response = await api.get('/modalidades');
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/modalidades', data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/modalidades/${id}`);
    return response.data;
  }
};

export const turmaService = {
  getAll: async () => {
    const response = await api.get('/turmas');
    return response.data;
  },
  getById: async (id: number) => {
    const response = await api.get(`/turmas/${id}`);
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/turmas', data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/turmas/${id}`);
    return response.data;
  }
};