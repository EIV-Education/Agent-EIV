# Lark AI Agent (EIV Education)

AI Agent chay tren Lark co kha nang **hanh dong that su** thay vi chi tra loi chat: tao/sua ban ghi trong Lark Base (Bitable), tao Task, dat lich Calendar, gui tin nhan chu dong, gui/tim email, tao bao cao (Lark Docs), va goi cac API noi bo cua EIV. Bo nao ra quyet dinh la Gemini (Google AI) qua co che function calling: Gemini tu chon tool nao can goi de hoan thanh yeu cau, thay vi chi sinh van ban.

## Kien truc

```
Nguoi dung nhan tin cho bot tren Lark
        -> Lark day event "im.message.receive_v1" qua ket noi WebSocket thuong truc (persistent connection)
        -> Gemini (function-calling loop) doc noi dung, quyet dinh goi tool nao
        -> Tool goi Lark Open API / SMTP-IMAP / API noi bo de HANH DONG that
        -> Gemini tom tat ket qua -> bot tra loi lai nguoi dung tren Lark
```

App dung che do **Persistent Connection** (ket noi WebSocket thuong truc, SDK tu quan ly reconnect) de nhan su kien tu Lark thay vi webhook HTTP truyen thong - **khong can domain public, khong can cau hinh Request URL/Encrypt Key/Verification Token**. Server Express chi con dung cho endpoint `/health` (kiem tra tien trinh con song), khong bat buoc phai expose ra internet.

Cac tool hien co (`src/agent/tools.ts`):

| Tool | Chuc nang |
|---|---|
| `send_lark_message` | Gui tin nhan chu dong toi nguoi/nhom khac |
| `create_lark_base` | Tao moi hoan toan mot Lark Base, co the kem san bang va cac cot du lieu |
| `bitable_create_record` / `update` / `delete` / `search` | Thao tac Lark Base da co san |
| `create_lark_task` | Tao cong viec trong Lark Task |
| `create_lark_calendar_event` | Tao su kien Lark Calendar |
| `create_report_doc` | Tao bao cao dang tai lieu Lark Docs |
| `search_lark_department` / `list_department_members` | Tim phong ban theo ten va lay danh sach thanh vien (open_id that) - dung de moi ca mot team vao lich/tin nhan |
| `list_chat_members` / `list_recent_messages` | Doc danh sach thanh vien va tin nhan gan day cua mot nhom chat de nam ngu canh |
| `search_lark_docs` | Tim kiem noi dung trong Lark Docs/Wiki/Sheet/Base cua cong ty theo tu khoa |
| `submit_lark_approval` / `get_approval_status` | Gui yeu cau phe duyet (Lark Approval) va tra cuu trang thai |
| `send_email` / `search_email` | Gui / tim kiem email that (SMTP/IMAP) |
| `call_internal_api` | Goi API noi bo cua EIV (theo allowlist domain) |

## 1. Tao Lark App

1. Vao https://open.larksuite.com/app (quoc te) hoac https://open.feishu.cn/app (Trung Quoc) -> **Create App** -> chon "Custom App" (self-build).
2. Vao **Features -> Bot**, bat kha nang Bot cho app.
3. Vao **Permissions & Scopes**, cap cac quyen sau (tuy tinh nang muon dung):
   - `im:message` va `im:message:send_as_bot` (gui/nhan tin nhan)
   - `bitable:app` (doc/ghi Lark Base)
   - `task:task:write` (tao Task)
   - `calendar:calendar` (tao su kien)
   - `docx:document` (tao tai lieu bao cao)
   - `contact:department.base:readonly` va `contact:user.base:readonly` (tim phong ban/thanh vien de tu dong moi vao lich/tin nhan) - tim trong muc "Contact"/"Danh ba".
   - `im:message:readonly` va `im:chat:readonly` (doc lai tin nhan/thanh vien nhom de nam ngu canh cuoc tro chuyen).
   - `search:docs.wiki:readonly` (hoac ten tuong duong trong muc "Search"/"Docs") de tim kiem noi dung Docs/Wiki/Sheet/Base cua cong ty.
   - `approval:approval` (gui/tra cuu yeu cau phe duyet Lark Approval) - can biet truoc `approval_code` cua tung quy trinh duyet (lay trong Lark Approval Admin) thi bot moi gui duoc, bot khong tu tao quy trinh moi.
   - Quyen quan ly collaborator/permission cua Drive (tim trong muc "Docs"/"Drive Permission", ten thuong la `drive:drive` hoac tuong tu) - **BAT BUOC** de bot tu cap quyen chinh sua cho nguoi yeu cau ngay sau khi tao Base/Docs moi, neu khong nguoi do se chi xem duoc, khong sua duoc (vi bot/app la nguoi so huu tai nguyen vua tao).
   - Mot so quyen o tren can **quan tri vien Lark duyet** truoc khi dung duoc (thuong hien banner "Cho phe duyet" trong Console) - hay bao truoc voi IT/admin cua EIV.
4. Vao **Events & Callbacks -> Event Configuration**:
   - Bam icon but chi canh **Subscription mode** -> chon **"Receive events/callbacks through persistent connection"** (khuyen nghi, khong can domain public).
   - Vao **Events**, subscribe (them) event `im.message.receive_v1`.
5. Vao **Credentials**, copy `App ID` va `App Secret` vao `.env`.
6. Publish app (hoac dung o che do Developer/Test cho workspace noi bo).
7. Trong nhom chat Lark, moi bot vao nhom va **@ nhac** de bot phan hoi (o chat 1-1 thi bot phan hoi moi tin nhan).

> Neu ban muon dung webhook HTTP (Request URL) truyen thong thay vi persistent connection, xem lich su git cua repo nay truoc thoi diem doi sang WSClient de tham khao cach lam cu (`Lark.adaptExpress`).

## 2. Cau hinh

```bash
cp .env.example .env
```

Dien cac gia tri:

- `LARK_APP_ID`, `LARK_APP_SECRET`: lay tu app vua tao o buoc 1.
- `LARK_DOMAIN`: `lark` (quoc te, larksuite.com) hoac `feishu` (Trung Quoc, feishu.cn).
- `LARK_ENCRYPT_KEY`, `LARK_VERIFICATION_TOKEN`: **khong bat buoc** voi che do persistent connection, co the de trong.
- `GEMINI_API_KEY`: API key Gemini tai https://aistudio.google.com/apikey.
- `EMAIL_*`: thong tin SMTP/IMAP neu can bat tinh nang gui/tim email (Gmail can dung "App Password", khong dung mat khau thuong).
- `INTERNAL_API_ALLOWED_BASE_URLS`: danh sach domain API noi bo EIV duoc phep goi (bat buoc phai khai bao truoc thi tool `call_internal_api` moi hoat dong - day la bien phap chong SSRF).
- `DEFAULT_BITABLE_APP_TOKEN` / `DEFAULT_BITABLE_TABLE_ID`: bang Lark Base mac dinh de agent thao tac khi nguoi dung khong chi ro.

## 3. Chay thu (local)

```bash
npm install
npm run dev
```

Khong can ngrok hay domain public gi ca - app tu ket noi ra Lark qua WebSocket. Log se bao `Da ket noi Lark qua persistent connection (WebSocket)` khi thanh cong.

## 4. Build & chay production

```bash
npm run build
npm start
```

## 4b. Deploy len Railway (khuyen nghi cho chay 24/7)

Repo da co san `railway.json` (build bang Nixpacks, chay `npm start`).

1. Vao https://railway.app -> dang nhap bang GitHub.
2. **New Project -> Deploy from GitHub repo** -> chon repo `EIV-Education/Agent-EIV` -> chon branch dang dung.
3. Vao tab **Variables**, them toan bo bien trong `.env` (LARK_APP_ID, LARK_APP_SECRET, LARK_DOMAIN, GEMINI_API_KEY, GEMINI_MODEL, cac bien EMAIL_*, INTERNAL_API_*, DEFAULT_* neu dung) - **khong can tu dat `PORT`**, Railway tu dong cap. Sau khi them xong nho bam nut **Deploy** (banner o dau trang Variables) de ap dung - "Redeploy" tren mot deployment cu se KHONG lay bien moi.
4. **Khong can generate domain** - day la diem khac biet so voi webhook truyen thong, service co the la "Unexposed" van hoat dong binh thuong vi ket noi la chieu tu server ra Lark (outbound), khong phai Lark goi vao.
5. Vao xem **Deploy Logs**, xac nhan thay dong `Da ket noi Lark qua persistent connection (WebSocket)` khong loi.
6. Vao lai nhom chat Lark da moi bot, @ nhac bot de thu.

Moi lan push code moi len branch da noi, Railway se tu dong build & deploy lai.

## 5. Bao mat

- `call_internal_api` chi goi duoc cac domain trong `INTERNAL_API_ALLOWED_BASE_URLS` - khong the goi URL bat ky (chong SSRF).
- Ket noi persistent connection va cac API call deu di qua HTTPS/WSS xac thuc bang App ID/Secret, xu ly boi SDK chinh thuc `@larksuiteoapi/node-sdk`.
- Khong commit file `.env` (da co trong `.gitignore`).

## 6. Mo rong them

Them tool moi bang cach:
1. Viet ham goi API tuong ung trong `src/lark/*.ts`, `src/email/*.ts`, hoac `src/internal/*.ts`.
2. Khai bao tool (ten, mo ta, JSON schema input) trong `toolDefinitions` (`src/agent/tools.ts`).
3. Them case xu ly trong `executeTool`.

Gemini se tu dong biet cach dung tool moi dua vao mo ta ban khai bao.
