# SRS/API Contract

- SRS/API là source of truth cho business flow, acceptance criteria, DTO, validation, permission, status/error code.
- Plan phải có trace SRS → API/status/error → FE behavior → UI state/message → file/hook → evidence.
- Không invent field/DTO/status/error code nếu SRS/API chưa có.
- Nếu response khác FE model, dùng mapper; không map DTO rải rác trong JSX.
- API service không chứa UI/toast/navigation/form logic.
- Không handle 401/403 trong component; dùng interceptor/global handler.
- Field validation hiển thị inline; business error dùng form alert/toast/core message theo pattern project.
