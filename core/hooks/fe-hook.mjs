/**
 * Hook runtime của plugin `fe` — lớp gate "cứng" khi agent đang chạy.
 *
 * Logic nằm trong `runHook` của engine (`packages/engine/src/hook-core.mjs`);
 * file này chỉ gắn domain pack FE. Mức thực thi qua biến môi trường
 * FE_KIT_HOOKS: `off` | `warn` | `enforce` (khi chạy `claude plugin eval`:
 * EVAL_FE_KIT_HOOKS). Mọi lỗi nội bộ đều thoát 0 và không in gì.
 *
 * File được esbuild bundle (kèm engine và validators) vào plugins/fe/hooks/.
 */
import { runHook } from '@frontend-delivery-kit/engine';
import { fePack } from '@frontend-delivery-kit/validators';

// esbuild `define` thay hằng này khi bundle; chạy trực tiếp từ source thì là 'dev'.
const KIT_VERSION = typeof __FE_KIT_VERSION__ !== 'undefined' ? __FE_KIT_VERSION__ : 'dev';

runHook(fePack, { version: KIT_VERSION });
