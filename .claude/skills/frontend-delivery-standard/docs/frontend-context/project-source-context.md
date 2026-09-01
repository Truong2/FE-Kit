---
doc_name: project-source-context
doc_version: 1.0.0
status: draft
owner:
last_updated:
---

# Project Source Context

File này mô tả project đang dùng gì. Agent phải đọc file này để biết stack, folder, command và source convention cấp project.

## 1. Project stack

| Mục | Giá trị |
|---|---|
| Framework | React Vite / Next.js / Khác |
| Language | TypeScript |
| Package manager | npm / yarn / pnpm / bun |
| UI library |  |
| Data fetching | React Query / SWR / Khác |
| State | Zustand / Redux / Context / Khác |
| Form | React Hook Form / Formik / Ant Form / Khác |
| Validation | Zod / Yup / Khác |
| i18n | react-i18next / next-intl / Khác |
| Router | React Router / Next App Router / Khác |

## 2. Commands

| Mục đích | Command |
|---|---|
| Install |  |
| Dev |  |
| Typecheck |  |
| Lint |  |
| Test |  |
| Build |  |

## 3. Folder convention

| Concern | Path |
|---|---|
| Routes/pages |  |
| Features/modules |  |
| Shared components |  |
| API services/client |  |
| Query keys |  |
| Store |  |
| Hooks |  |
| Schemas |  |
| Utils |  |
| i18n messages |  |
| Tests |  |

## 4. Source inspection notes

- Source hiện tại chỉ là reference, không phải luôn là chuẩn tuyệt đối.
- Không copy pattern xấu từ source cũ.
- Nếu source conflict với SRS/Figma/rule contract, phải ghi blocker hoặc hỏi người phụ trách.
- Nếu thiếu convention quan trọng, inspect shared layer trước khi tự tạo pattern mới.
