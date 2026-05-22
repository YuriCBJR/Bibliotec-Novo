export interface Autor {
  id: string;
  nome: string;
}

export interface Livro {
  id: string;
  nome: string;
  autorId: string;
  autorNome?: string;
  autor?: {
    id: string;
    nome: string;
  };
  genero: string;
  ano: number;
  codigo: number; // Código CDD
  resumo: string;
  quantidade: number;
  cor?: string; // Cor personalizada da lombada do livro
  disponivel: boolean;
}

export interface Emprestimo {
  id: string;
  livroId: string;
  tituloLivro?: string;
  generoLivro?: string;
  dataEmprestimo: string;
  dataDevolucao?: string | null;
  ativo: boolean; // Ativo = pendente de devolução
}

export interface AppSettings {
  isMockMode: boolean;
  apiUrl: string;
}
