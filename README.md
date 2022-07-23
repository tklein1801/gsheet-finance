# gsheet-finance

## Installation

1. Create `.env` file

> You need to provide an Github **P**ersonal **A**ccess **T**oken in order to install all the required dependencies
> You can simply add your PAT to the `.env`-file and install the depencies

```env
NPM_TOKEN=<GITHUB_PAT>

PRODUCTION=
APPLICATION=

SPREADSHEET_ID=

TRANSFER_TOKEN=
LARAVEL=
XSRF=

DB_HOST=
DB_USER=
DB_PASSWORD=
DB_DATABASE=
```

2. Install dependencies

```shell
npm install
```

3. Create local `config.json`

```json
{
  "paychecks": {
    "enabled": false,
    "execution": "0 3 * * SUN",
    "spreadsheet": {
      "paychecks": "SPREADSHEET_NAME",
      "outgoings": "SPREADSHEET_NAME"
    },
    "paymentAccount": "RLRPG_IBAN"
  },
  "loans": {
    "enabled": true,
    "execution": "0 3 * * *",
    "spreadsheet": {
      "loans": "SPREADSHEET_NAME"
    },
    "bankAccount": "RLRPG_IBAN"
  }
}
```

4. Run your programm using

```shell
npm run start
```
