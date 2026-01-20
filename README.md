# Finanças Casal Medeiros

Aplicativo web responsivo para controle financeiro do casal, com cadastro de pessoas que pegaram o cartão emprestado, dívidas a receber e contas da casa. Os dados ficam na nuvem via Firebase, permitindo acesso em vários dispositivos.

## Requisitos

- Node.js 20.19+ (ou 22.12+)
- Conta Firebase com Authentication e Firestore habilitados

## Configuração rápida

1. Copie `env.example` para `.env` (crie manualmente).
2. Preencha as variáveis com as chaves do Firebase.
3. Instale as dependências:

```
npm install
```

4. Inicie o projeto:

```
npm run dev
```

## Coleções no Firestore

Os dados são organizados por usuário:

- `users/{uid}/people`
- `users/{uid}/debts`
- `users/{uid}/bills`

## Autenticação

O app usa email e senha via Firebase Authentication. Crie uma conta no próprio app para começar.

## Regras do Firestore

Para garantir acesso apenas ao usuário logado, publique estas regras no Firebase:

1. Acesse **Firestore Database → Rules**.
2. Substitua pelas regras do arquivo `firestore.rules`.
3. Clique em **Publish**.

## Validação rápida

- Se o `.env` não estiver correto, o app exibirá um erro claro ao iniciar.
- Após login, o email aparece no topo da aplicação — isso confirma a sessão ativa.
