# Báo cáo review UI theo Figma

## 1. Screenshot evidence

| Screen/state | Figma screenshot | Implementation screenshot | Evidence level | Status |
|---|---|---|---|---|
|  |  |  | L1 Playwright / L2 manual / L3 static |  |

## 2. Playwright screenshot diff

| Screen/state | Command | Đã chạy? | Kết quả | Diff artifact | Ghi chú |
|---|---|---|---|---|---|
|  |  | Có / Không / Không áp dụng | Passed / Failed / Not run |  |  |

## 3. UI mismatch

| Khu vực | Severity | Mô tả lệch | Cách xử lý | Owner | Trạng thái |
|---|---|---|---|---|---|
|  | Critical / High / Medium / Low |  |  |  |  |

## 4. Kết luận

| Field | Giá trị |
|---|---|
| ui_match_review_status | passed / waived / needs_fix |
| ui_match_severity_status | none / low / medium / high / critical |
| playwright_screenshot_diff_status | passed / failed / manual_review / not_required / waived |
| ui_figma_review_report_status | created / updated |

> Không PR nếu còn Critical/High mismatch chưa fix/waive.
