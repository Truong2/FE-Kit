// Script hook của pack mẫu (giống core/hooks/fe-hook.mjs của FE), để test chạy hook như Claude Code.
import { runHook } from '@frontend-delivery-kit/engine';
import { docsPack } from './index.mjs';

runHook(docsPack, { version: 'test' });
