# CR Impact Report

Dùng khi CR/file trả lời xuất hiện sau khi task đã code xong, đã PR-ready, hoặc đã đẩy PR.

## Snapshot

| Trường | Giá trị |
|---|---|
| Task gốc |  |
| PR hiện tại | Chưa có / Open / Merged / Released |
| SRS baseline |  |
| CR/file trả lời |  |
| SRS update status | Updated / Pending BA update / Unknown |
| Impact classification | In-scope clarification / Scope change / Post-merge change / New feature/change |
| Decision | Update current PR / Block current PR / Create follow-up task / Create new feature task |

## Impact analysis

| Hạng mục | Có ảnh hưởng? | Ghi chú |
|---|---|---|
| Business rule |  |  |
| API contract |  |  |
| Permission/security |  |  |
| UI/Figma behavior |  |  |
| Data mapping |  |  |
| Tests |  |  |
| Release scope |  |  |

## Decision rule

| Tình huống | Xử lý |
|---|---|
| PR chưa merge, CR chỉ làm rõ requirement cũ | Sync vào task/PR hiện tại |
| PR chưa merge, CR đổi scope/behavior lớn | Hỏi PM/owner hoặc tạo follow-up task |
| PR đã merge, chưa release | Tạo follow-up task mới |
| PR đã release | Tạo task/feature/change mới |

## Next action

- [ ] Update current task/PR
- [ ] Create follow-up task
- [ ] Create new feature/change task
- [ ] Ask PM/owner to decide whether current PR is blocked
