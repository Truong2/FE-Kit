# Evidence & Scope Contract

- Code chỉ được sửa trong phạm vi file/module đã ghi trong `planning/implementation-plan.md` hoặc được human xác nhận.
- Nếu phát hiện cần sửa ngoài plan, dừng để update plan/input-sync trước khi code tiếp.
- Review/PR phải kiểm tra scope diff: file đã sửa có nằm trong plan/checklist không.
- Test/lint/typecheck/build chỉ được claim pass khi đã chạy thật; nếu chưa chạy phải ghi `Chưa chạy` và lý do.
- `output/test-summary.md` phải có command evidence log: command, kết quả, thời điểm, ghi chú.
- Một dòng chỉ là bằng chứng khi cột "Đã chạy thật?" ghi `Có` và cột "Kết quả" ghi `Passed` hoặc `Failed`. Ô trống, ô còn nguyên lựa chọn của template (`Có / Không`), hoặc `Có` kèm `Not run` là dòng thiếu dữ liệu; validator không tính. Lệnh chưa chạy ghi `Không` kèm lý do ở cột ghi chú.
- Lệnh chạy lại sau bugfix thì thêm dòng mới, không sửa dòng cũ; lần chạy gần nhất quyết định kết quả.
- Với UI/Figma, ưu tiên Playwright screenshot diff nếu project có setup. Nếu không có, ghi evidence level L2 manual hoặc L3 static và lý do.
- Không PR-ready nếu thiếu command evidence bắt buộc hoặc scope diff bị fail.
- `workflow-status.md` phải cập nhật `scope_diff_status`, `command_evidence_status`, `test_command_log_status`, `playwright_screenshot_diff_status`.
