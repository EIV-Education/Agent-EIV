# Lark AI Agent (EIV Education)

AI Agent chay tren Lark co kha nang **hanh dong that su** thay vi chi tra loi chat: tao/sua ban ghi trong Lark Base (Bitable), tao Task, dat lich Calendar, gui tin nhan chu dong, gui/tim email, tao bao cao (Lark Docs), va goi cac API noi bo cua EIV. Bo nao ra quyet dinh la Gemini (Google AI) qua co che function calling: Gemini tu chon tool nao can goi de hoan thanh yeu cau, thay vi chi sinh van ban.

## Kien truc

```
Nguoi dung nhan tin cho bot tren Lark
        -> Lark gui event "im.message.receive_v1" ve /webhook/event
        -> Gemini (function-calling loop) doc noi dung, quyet dinh goi tool nao
        -> Tool goi Lark Open API / SMTP-IMAP / API noi bo de HANH DONG that
        -> Gemini tom tat ket qua -> bot tra loi lai nguoi dung tren Lark
```

Cac tool hien co (`src/agent/tools.ts`):

| Tool | Chuc nang |
|---|---|
| `send_lark_message` | Gui tin nhan chu dong toi nguoi/nhom khac |
| `bitable_create_record` / `update` / `delete` / `search` | Thao tac Lark Base |
| `create_lark_task` | Tao cong viec trong Lark Task |
| `create_lark_calendar_event` | Tao su kien Lark Calendar |
| `create_report_doc` | Tao bao cao dang tai lieu Lark Docs |
| `send_email` / `search_email` | Gui / tim kiem email that (SMTP/IMAP) |
| `call_internal_api` | Goi API noi bo cua EIV (theo allowlist domain) |

## 1. Tao Lark App

1. Vao https://open.larksuite.com/app (quoc te) hoac https://open.feishu.cn/app (Trung Quoc) -> **Create App** -> chon "Custom App".
2. Vao **Features -> Bot**, bat kha nang Bot cho app.
3. Vao **Permissions & Scopes**, cap cac quyen sau (tuy tinh nang muon dung):
   - `im:message` va `im:message:send_as_bot` (gui/nhan tin nhan)
   - `bitable:app` (doc/ghi Lark Base)
   - `task:task:write` (tao Task)
   - `calendar:calendar` (tao su kien)
   - `docx:document` (tao tai lieu bao cao)
4. Vao **Event Subscriptions**:
   - Bat "Subscribe via API" (long polling) hoac nhap **Request URL**: `https://<domain-cong-khai-cua-ban>/webhook/event`
   - Lark se goi thu URL nay de verify (`url_verification` challenge) - server da xu ly san.
   - Subscribe event `im.message.receive_v1`.
   - Copy **Encrypt Key** va **Verification Token** vao file `.env`.
5. Vao **Credentials**, copy `App ID` va `App Secret` vao `.env`.
6. Publish app (hoac dung o che do Developer/Test cho workspace noi bo).
7. Trong nhom chat Lark, moi bot vao nhom va **@ nhac** de bot phan hoi (o chat 1-1 thi bot phan hoi moi tin nhan).

## 2. Cau hinh

```bash
cp .env.example .env
```

Dien cac gia tri:

- `LARK_APP_ID`, `LARK_APP_SECRET`, `LARK_ENCRYPT_KEY`, `LARK_VERIFICATION_TOKEN`: lay tu app vua tao o buoc 1.
- `LARK_DOMAIN`: `lark` (quoc te, larksuite.com) hoac `feishu` (Trung Quoc, feishu.cn).
- `GEMINI_API_KEY`: API key Gemini tai https://aistudio.google.com/apikey.
- `EMAIL_*`: thong tin SMTP/IMAP neu can bat tinh nang gui/tim email (Gmail can dung "App Password", khong dung mat khau thuong).
- `INTERNAL_API_ALLOWED_BASE_URLS`: danh sach domain API noi bo EIV duoc phep goi (bat buoc phai khai bao truoc thi tool `call_internal_api` moi hoat dong - day la bien phap chong SSRF).
- `DEFAULT_BITABLE_APP_TOKEN` / `DEFAULT_BITABLE_TABLE_ID`: bang Lark Base mac dinh de agent thao tac khi nguoi dung khong chi ro.

## 3. Chay thu (local)

```bash
npm install
npm run dev
```

Server lang nghe tai `http://localhost:3000`. Dung [ngrok](https://ngrok.com) hoac tuong tu de expose ra internet cho Lark goi webhook:

```bash
ngrok http 3000
```

Roi cap nhat lai **Request URL** trong Event Subscriptions thanh `https://<ngrok-id>.ngrok.io/webhook/event`.

## 4. Build & chay production

```bash
npm run build
npm start
```

## 4b. Deploy len Railway (khuyen nghi cho chay 24/7)

Repo da co san `railway.json` (build bang Nixpacks, chay `npm start`).

1. Vao https://railway.app -> dang nhap bang GitHub.
2. **New Project -> Deploy from GitHub repo** -> chon repo `EIV-Education/Agent-EIV` -> chon branch dang dung (`claude/lark-ai-agent-actions-a51fbn` hoac `main` sau khi merge).
3. Railway se tu build va deploy. Vao tab **Variables**, them toan bo bien trong `.env` (LARK_APP_ID, LARK_APP_SECRET, LARK_DOMAIN, LARK_ENCRYPT_KEY, LARK_VERIFICATION_TOKEN, GEMINI_API_KEY, GEMINI_MODEL, cac bien EMAIL_*, INTERNAL_API_*, DEFAULT_* neu dung) - **khong can tu dat `PORT`**, Railway tu dong cap.
4. Vao tab **Settings -> Networking -> Generate Domain** de co URL public dang `https://<ten-app>.up.railway.app`.
5. Quay lai Lark Developer Console -> **Event Subscriptions** -> dan `https://<ten-app>.up.railway.app/webhook/event` vao **Request URL** -> Lark se tu goi thu (`url_verification`) va bao thanh cong ngay neu deploy dung.
6. Vao lai nhom chat Lark da moi bot, @ nhac bot de thu.

Moi lan push code moi len branch da noi (hoac merge vao nhanh Railway theo doi), Railway se tu dong build & deploy lai.

## 5. Bao mat

- `call_internal_api` chi goi duoc cac domain trong `INTERNAL_API_ALLOWED_BASE_URLS` - khong the goi URL bat ky (chong SSRF).
- Signature/ma hoa webhook cua Lark (Encrypt Key + Verification Token) duoc SDK chinh thuc `@larksuiteoapi/node-sdk` xu ly, khong tu decode thu cong.
- Khong commit file `.env` (da co trong `.gitignore`).

## 6. Mo rong them

Them tool moi bang cach:
1. Viet ham goi API tuong ung trong `src/lark/*.ts`, `src/email/*.ts`, hoac `src/internal/*.ts`.
2. Khai bao tool (ten, mo ta, JSON schema input) trong `toolDefinitions` (`src/agent/tools.ts`).
3. Them case xu ly trong `executeTool`.

Gemini se tu dong biet cach dung tool moi dua vao mo ta ban khai bao.
