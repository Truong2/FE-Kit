# Baseline eval hành vi

File này do `node evals/summarize.mjs` sinh ra, không sửa tay. Mỗi file JSON bên cạnh là kết quả một lượt `plugin-evals.yml` (một mức hook).

Luật bật `enforce` mặc định: mọi case tag `gate` đạt ≥ 0.8 ở enforce, `cook-proceeds-when-ready` đạt 1, enforce không kém warn quá 0.05 ở case gate, không có run lỗi.

Chưa có baseline nào.
