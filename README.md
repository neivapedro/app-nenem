# app-nenem · Nenê

App (PWA) de acompanhamento do bebê, compartilhado entre os pais. Abre no Safari e é instalado na Tela de Início do iPhone. Cada responsável tem o próprio login, e os dois ficam ligados à mesma família: o que um registra aparece na hora no celular do outro.

Mesma base do app-dieta: React + Vite, GitHub Pages, Supabase (mesmo projeto e mesmo login do Diário de Carga e do app-dieta) e calendário assinado do iPhone.

## O que o app faz (Fase 1)

| Tela | Conteúdo |
|---|---|
| **Hoje** | Contagem até a data prevista e o botão "O bebê nasceu!" (com peso, comprimento e perímetro cefálico). Botões grandes para **Mamada** (cronômetro por peito, com troca de lado, pausa e o lado em que terminou a última), **Mamadeira** (ml, leite materno ou fórmula), **Fralda** (um toque: xixi, cocô ou os dois; cor do cocô opcional, com alerta para cores claras como na Caderneta da Criança) e **Sono** (cronômetro até "Acordou"). Cartões de mamada e sono em andamento, resumo do dia, próximo compromisso e últimos registros com quem registrou. Todo registro tem **Desfazer**. |
| **Histórico** | Registros por dia com o resumo de cada dia (alimentações, tempo no peito, ml, fraldas, sono), filtro por tipo, edição e exclusão. Carrega 45 dias e busca mais sob pedido. |
| **Agenda** | Consultas, exames, vacinas e outros compromissos (com hora ou dia inteiro, local, observação e aviso). Tudo vai para o Calendário do iPhone dos dois. |
| **Ajustes** | Dados do bebê, família e convite do outro responsável (código de 6 letras), avisos no celular, calendário do iPhone e conta. |

### Regras

- **Família:** uma conta pertence a uma família. Quem cria a família convida o outro responsável por um código de 6 letras (vale 7 dias e só uma vez). O isolamento entre famílias é feito pelo Row Level Security do banco.
- **Tempo real:** o app recebe as mudanças do outro responsável pelo Realtime do Supabase e confere de novo a cada minuto com o app aberto e ao voltar para ele.
- **Sem internet:** cada registro leva um id criado no aparelho e vai para uma fila guardada no celular. A tela muda na hora e a fila é enviada quando a conexão volta (reenviar nunca duplica). Sem conexão, o app abre com a última cópia dos dados.
- **Mamada:** o tempo de cada peito vem dos trechos registrados pelo cronômetro (cada troca fecha um trecho e abre outro). Mamada registrada depois: os minutos de cada peito em sequência a partir do início.
- **Resumo do dia:** conta pelo início de cada registro; o sono conta só a parte dentro do dia (um sono de 22h às 2h divide entre os dois dias).
- **Avisos no celular** (cada responsável escolhe os seus, em Ajustes):
  - "Já faz X horas desde a última mamada": conta do início da última mamada ou mamadeira, não avisa com mamada em andamento e para de avisar 3 horas depois do horário;
  - compromissos da agenda na antecedência escolhida (dia inteiro: contada a partir das 8h do dia).
  - A função `nenem-lembretes` roda a cada 5 minutos e nunca avisa duas vezes a mesma coisa.
- **Calendário do iPhone:** calendário assinado, como no app-dieta. Cada responsável tem um endereço secreto próprio e os dois veem a mesma agenda da família, mais os mesversários até 2 anos. O iPhone atualiza de tempos em tempos.

A lógica está em `src/lib/` e `supabase/functions/_shared/` (usada pelo app e pelas funções do servidor), com testes ao lado de cada arquivo.

## Rodar localmente

```bash
npm install
npm run dev:local   # sem nuvem: dados só no navegador (modo demonstração)
npm run dev         # usando o Supabase de src/config.ts
npm test            # testes
```

## Colocar no ar (uma vez)

### 1. GitHub

1. **Settings → General → Danger Zone → Change visibility → Public.** O GitHub Pages grátis exige repositório público. Isso deixa visível o código, não os dados: cada família só acessa as próprias linhas no Supabase.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Settings → Secrets and variables → Actions → New repository secret:** `SUPABASE_ACCESS_TOKEN`, com um token pessoal do Supabase (supabase.com → Account → Access Tokens). Pode ser um token novo; é o mesmo tipo de token usado no app-dieta.

A partir daí, cada atualização da `main`:
- roda os testes e publica o app em <https://neivapedro.github.io/app-nenem/> (`publicar.yml`);
- quando muda algo em `supabase/`, cria/atualiza as tabelas `nenem_*`, publica as funções `nenem-lembretes` e `nenem-calendario` e inclui o endereço do app nos Redirect URLs do login (`atualizar-supabase.yml`). Dá para rodar de novo em **Actions → Atualizar Supabase → Run workflow**.

Os avisos usam os segredos que o app-dieta já configurou no projeto: as chaves VAPID e o `CRON_SECRET` das Edge Functions e, no Vault, `app_dieta_projeto_url` e `app_dieta_cron_secret`. O workflow avisa se os do Vault não forem encontrados.

### 2. No iPhone (cada responsável)

1. Abra <https://neivapedro.github.io/app-nenem/> no **Safari** → Compartilhar → **Adicionar à Tela de Início** e abra pelo ícone.
2. Entre com o e-mail e a senha do Diário de Carga/app-dieta, ou crie uma conta.
3. Primeiro acesso:
   - quem começa escolhe **Começar do zero** (nome do bebê, sexo e data prevista);
   - em **Ajustes → Família → Convidar**, envia o código para o outro responsável, que escolhe **Tenho um código**.
4. **Ajustes → Avisos → Ativar avisos** e **Ajustes → Calendário → Adicionar ao Calendário → Assinar**.

## Próximas fases

- **Fase 2:** peso, comprimento e perímetro cefálico com as curvas da OMS (percentis); vacinas do calendário do PNI (SUS) e da SBP (rede particular) com doses aplicadas, próximas e atrasadas, no calendário e nos avisos.
- **Fase 3:** marcos do desenvolvimento, remédios, alergias, exames, documentos, relatório em PDF para o pediatra e introdução alimentar.
