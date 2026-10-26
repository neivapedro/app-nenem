// Estilos de cada tela (Hoje, Histórico, Saúde...): todos os .css de src/estilos entram sozinhos.
// Fica num módulo próprio para entrar DEPOIS da base (estilos.css): o Vite põe o glob no topo do módulo.
import.meta.glob('./estilos/*.css', { eager: true });
