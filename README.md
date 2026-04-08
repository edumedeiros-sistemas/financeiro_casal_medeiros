# Finanças Casal Medeiros

Aplicativo web responsivo para controle financeiro do casal: pessoas, dívidas a receber, contas da casa, categorias e relatórios (incluindo PDF). Os dados ficam na nuvem via **Firebase** (Auth + Firestore), com acesso em vários dispositivos.

## Requisitos

- **Node.js** 20.19+ (o Netlify está configurado para 20.19.0 em `netlify.toml`)
- Projeto **Firebase** com **Authentication** (email/senha) e **Firestore** habilitados
- (Opcional) **Firebase CLI** para publicar regras e Cloud Functions: `npm i -g firebase-tools`

## 1. Clonar e instalar

```bash
npm install
```

## 2. Variáveis de ambiente

1. Copie `env.example` para `.env` na raiz do projeto.
2. Preencha com os valores do Firebase: **Project settings → Your apps → SDK setup and configuration** (ícone `</>`).

| Variável | Onde aparece no console |
|----------|-------------------------|
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

Se algo faltar, o app **não inicia** e mostra quais chaves estão ausentes.

## 3. Firebase Console — o que habilitar

1. **Authentication → Sign-in method**: ative **Email/Password**.
2. **Firestore Database**: crie o banco (modo produção ou teste, conforme sua preferência).

## 4. Regras do Firestore

As regras ficam em `firestore.rules` na raiz. Para publicar:

- **Pelo console:** Firestore → **Rules** → cole o conteúdo de `firestore.rules` → **Publish**.
- **Pela CLI:** na raiz do repo, com `firebase login` e projeto selecionado: `firebase deploy --only firestore:rules`.

**Nota:** as regras atuais definem um **administrador** por email fixo e um modelo multi-casal (`households`). Se mudar o email do admin, atualize `firestore.rules`, `AdminRoute.tsx`, `AppLayout.tsx` e a Cloud Function em `functions/index.js` de forma consistente.

## 5. Cloud Functions (exclusão de usuário pelo admin)

O projeto inclui a função callable `deleteUserAccount` em `functions/`.

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

O frontend precisa que as Functions estejam no **mesmo projeto** Firebase configurado no `.env`.

## 6. Rodar em desenvolvimento

```bash
npm run dev
```

Abra o endereço que o Vite mostrar (geralmente `http://localhost:5173`).

## 7. Build de produção

```bash
npm run build
```

Gera a pasta `dist/`. O script `npm run build:netlify` usa só o Vite (útil no Netlify se o `tsc -b` não for obrigatório no CI).

## 8. Deploy no Netlify

- **Build command:** `npm run build:netlify` (já em `netlify.toml`)
- **Publish directory:** `dist`
- Configure as **mesmas variáveis** `VITE_FIREBASE_*` em **Site settings → Environment variables**.

O arquivo `public/_redirects` envia rotas do SPA para `index.html` (evita 404 ao recarregar páginas internas).

## Modelo de dados no Firestore

- **`userProfiles/{uid}`** — perfil do usuário, incluindo `householdId` (casal ativo).
- **`households/{householdId}`** — cadastro do casal (nome, ativo, etc.).
- Por casal, subcoleções:
  - **`people`** — pessoas
  - **`debts`** — dívidas
  - **`bills`** — contas
  - **`categories`** — categorias

Fluxo típico: um usuário faz login; o admin associa o usuário a um casal (ou o usuário escolhe o casal na área administrativa de casais, conforme permissões).

## Autenticação

Login com **email e senha**. Registro público em `/registrar`. O admin pode cadastrar outros usuários em `/registro_financas` sem sair da sessão (usa um segundo app Firebase no mesmo projeto).

## Validação rápida

- Erro ao iniciar sem `.env` completo → confira as variáveis listadas na mensagem.
- Após login, o email no topo confirma sessão ativa.
- Sem `householdId` no perfil, telas que dependem do casal podem ficar vazias até o vínculo com um casal.
