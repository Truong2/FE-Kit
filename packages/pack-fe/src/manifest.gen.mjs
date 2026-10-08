// Sinh từ packages/pack-fe/pack.yaml bởi build/compile-packs.mjs. Không sửa tay: sửa pack.yaml rồi chạy `npm run build`.
export default {
  "id": "fe",
  "display_name": "FE-Kit",
  "plugin": "fe",
  "prompt_prefix": "FE",
  "env_prefix": "FE_KIT",
  "agent_prefix": "frontend-",
  "tasks_root": "docs/frontend-tasks",
  "config_dir": ".frontend-delivery",
  "project_config_file": ".frontend-delivery/standard.yaml",
  "status_file": "tracking/workflow-status.md",
  "writable_prefixes": [
    "docs/frontend-tasks/",
    "docs/frontend-context/"
  ],
  "scope_ignore": [
    "docs/frontend-tasks/",
    "docs/frontend-context/",
    ".frontend-delivery/"
  ],
  "planned_files_heading": "File sẽ tạo\\s*\\/\\s*cập nhật",
  "task_name_hint": "FE-<id>-<slug>",
  "task_files": {
    "required_docs": [
      "task.md",
      "planning/implementation-plan.md",
      "planning/build-checklist.md",
      "planning/questions.md",
      "tracking/workflow-status.md"
    ],
    "empty": [
      "output/figma-reference-screenshots/.gitkeep"
    ],
    "conditional": [
      "tracking/input-sync-report.md",
      "tracking/cr-impact-report.md",
      "tracking/review-bugs.md",
      "output/figma-extraction-summary.md",
      "output/review-report.md",
      "output/test-summary.md",
      "output/pr-summary.md",
      "output/ui-figma-review-report.md"
    ]
  },
  "modes": {
    "plan": {
      "state": "planning-mode",
      "agent": "frontend-planner",
      "artifacts": [
        "task.md",
        "planning/implementation-plan.md",
        "planning/build-checklist.md",
        "planning/questions.md",
        "tracking/workflow-status.md"
      ],
      "next": [
        "input-sync",
        "figma",
        "cook",
        "plan",
        "quick"
      ]
    },
    "quick": {
      "state": "quick-mode",
      "agent": null,
      "artifacts": [
        "tracking/workflow-status.md"
      ],
      "next": [
        "review",
        "test",
        "pr",
        "plan",
        "input-sync"
      ]
    },
    "input-sync": {
      "state": "input-sync-mode",
      "agent": "frontend-planner",
      "artifacts": [
        "tracking/input-sync-report.md",
        "planning/questions.md",
        "tracking/workflow-status.md"
      ],
      "next": [
        "plan",
        "input-sync",
        "figma",
        "cook",
        "bugfix",
        "review"
      ]
    },
    "figma": {
      "state": "figma-extraction-mode",
      "agent": "frontend-figma-specialist",
      "artifacts": [
        "output/figma-extraction-summary.md",
        "tracking/workflow-status.md"
      ],
      "next": [
        "cook",
        "plan",
        "input-sync",
        "figma"
      ]
    },
    "figma-review": {
      "state": "figma-review-mode",
      "agent": "frontend-figma-specialist",
      "artifacts": [
        "output/ui-figma-review-report.md",
        "tracking/workflow-status.md"
      ],
      "next": [
        "pr",
        "bugfix",
        "input-sync",
        "figma-review",
        "test"
      ]
    },
    "cook": {
      "state": "implementation-mode",
      "agent": "frontend-developer",
      "artifacts": [
        "planning/build-checklist.md",
        "tracking/workflow-status.md"
      ],
      "next": [
        "review",
        "cook",
        "input-sync",
        "plan"
      ]
    },
    "bugfix": {
      "state": "bugfix-mode",
      "agent": "frontend-developer",
      "artifacts": [
        "tracking/review-bugs.md",
        "tracking/workflow-status.md"
      ],
      "next": [
        "review",
        "bugfix",
        "input-sync",
        "test",
        "figma-review"
      ]
    },
    "review": {
      "state": "review-mode",
      "agent": "frontend-reviewer",
      "artifacts": [
        "output/review-report.md",
        "tracking/workflow-status.md"
      ],
      "next": [
        "bugfix",
        "input-sync",
        "figma-review",
        "test",
        "pr"
      ]
    },
    "test": {
      "state": "testing-mode",
      "agent": "frontend-tester",
      "artifacts": [
        "output/test-summary.md",
        "tracking/workflow-status.md"
      ],
      "next": [
        "figma-review",
        "pr",
        "bugfix",
        "input-sync",
        "test"
      ]
    },
    "pr": {
      "state": "pr-ready-mode",
      "agent": "frontend-release-manager",
      "artifacts": [
        "output/pr-summary.md",
        "tracking/workflow-status.md"
      ],
      "next": [
        "bugfix",
        "input-sync",
        "pr"
      ]
    }
  },
  "aliases": {
    "build": "cook",
    "figma-extract": "figma",
    "implement": "cook"
  },
  "terminal_next": [
    "none",
    "done",
    "completed",
    "merged"
  ],
  "always_allowed": [
    "plan",
    "input-sync"
  ],
  "source_edit_modes": [
    "cook",
    "bugfix",
    "quick"
  ],
  "source_edit_agent": "frontend-developer",
  "source_fix_route": "FE bugfix/cook",
  "plan_update_route": "input-sync",
  "read_inputs_hint": "Input cần đọc: mục \"Input ledger bắt buộc cho FE plan\" trong tracking/workflow-status.md.",
  "rules": {
    "always": [
      "core.md",
      "mode-output-contract.md",
      "plan-input-ledger-contract.md",
      "question-resolution-contract.md",
      "vietnamese-output.md",
      "efficiency-budget-contract.md",
      "untrusted-input-contract.md"
    ],
    "by_mode": {
      "srs-api-contract.md": [
        "plan",
        "input-sync",
        "cook",
        "quick",
        "bugfix",
        "review"
      ],
      "clean-code-contract.md": [
        "cook",
        "quick",
        "bugfix",
        "review"
      ],
      "evidence-scope-contract.md": [
        "cook",
        "review",
        "test",
        "figma-review",
        "pr"
      ],
      "review-bug-contract.md": [
        "review",
        "bugfix",
        "pr"
      ]
    },
    "conditional": [
      {
        "rule": "figma-ui-contract.md",
        "always": [
          "figma",
          "figma-review"
        ],
        "modes": [
          "plan",
          "cook",
          "quick",
          "bugfix",
          "review",
          "pr"
        ],
        "when_field": "figma_required"
      }
    ]
  },
  "mcp": {
    "server_name": "frontend-delivery",
    "tool_prefix": "fe",
    "skill_dir": "skills/frontend-delivery-standard",
    "next_prompt_heading": "Prompt bước tiếp theo",
    "first_command": "plan",
    "task_prop_description": "Tên task (FE-123-abc) hoặc đường dẫn task folder.",
    "task_name_description": "Tên task dạng FE-<id>-<slug>, vd FE-123-login-form.",
    "scope_self_reported": "Scope: dùng scope_diff_status tự khai.",
    "scope_unavailable": "Không tính được scope diff (không phải git repo hoặc không diff được base). Ghi scope_diff_status theo review thủ công và nêu lý do.",
    "planned_files_missing": "implementation-plan.md chưa khai file nào ở mục \"File sẽ tạo / cập nhật\" nên không đối chiếu được.",
    "status_fields": [
      "current_mode",
      "next_mode",
      "build_ready",
      "questions_resolution_gate_status",
      "blocking_questions_open",
      "figma_required",
      "figma_gate_status",
      "review_status",
      "critical_issues_open",
      "high_issues_open",
      "pr_status",
      "human_override"
    ],
    "descriptions": {
      "begin_mode": "GỌI ĐẦU TIÊN khi bắt đầu bất kỳ mode FE nào (plan/quick/input-sync/figma/cook/bugfix/review/test/figma-review/pr). Trả về: mode có được chạy không (gate câu hỏi blocking, build_ready, Figma, review), prompt phải chạy thay thế nếu bị chặn, artifact bắt buộc của mode và nguyên văn các rule áp dụng cho mode (không cần đọc file rule riêng).",
      "new_task": "Tạo task folder chuẩn trong docs/frontend-tasks/<tên> từ template của kit (task.md, implementation-plan, build-checklist, questions, workflow-status, thư mục figma screenshot). Không ghi đè file đã có. Dùng cho /fe:new-task thay vì tự copy template.",
      "validate_task": "Kiểm tra task folder có đủ file bắt buộc theo chuẩn Frontend Delivery không (task.md, implementation-plan, build-checklist, questions, workflow-status, thư mục figma screenshot). Dùng trước khi chuyển mode.",
      "validate_workflow": "Chạy toàn bộ gate của workflow-status.md: schema, blocking-question gate, SRS/Figma gate, evidence gate, routing hợp lệ. Task ở review/test/pr-ready thì đối chiếu thêm file đã sửa (git) với plan. GỌI TRƯỚC KHI KẾT THÚC mọi mode; đây là gate chính chặn agent nhảy mode sai.",
      "scope_diff": "So file thực sự thay đổi (git) với bảng \"File sẽ tạo / cập nhật\" trong implementation-plan.md. Dùng trong cook/bugfix/review/pr để phát hiện file sửa ngoài plan thay vì tự khai scope_diff_status.",
      "next_step": "Trả về prompt bước tiếp theo đọc trực tiếp từ tracking/workflow-status.md của task. Dùng khi không chắc mode kế tiếp là gì.",
      "task_status": "Đọc tóm tắt trạng thái task: mode hiện tại, các gate status chính, số câu hỏi blocking, số issue theo severity. Chỉ đọc, không sửa file."
    }
  }
};
