I've created a comprehensive optimization report for your YC Advisor project. Here's a summary of the key findings:

## Summary of Optimization Report

The report is now available at `OPTIMIZATION-REPORT.md` and covers:

### High Priority Issues (Immediate Action Recommended)

| Category | Issue | File |
|----------|-------|------|
| **Security** | Missing input validation | `api/chat/route.ts:46` |
| **Security** | No rate limiting | `api/chat/route.ts` |
| **Security** | Missing security headers | `next.config.mjs` |
| **A11y** | Buttons missing aria-labels | `Chat.tsx` |
| **Resilience** | No Error Boundary | `Chat.tsx` |
| **Performance** | ReactMarkdown components recreated on every render | `Chat.tsx:258-271` |
| **Maintainability** | Welcome message duplicated | `Chat.tsx:34-46, 153-166` |

### Key Optimizations by Category

**Frontend (7 issues)**
- Extract `markdownComponents` outside component to avoid recreation
- Add `useCallback` for `sendMessage`
- Add ARIA labels for accessibility
- Add Error Boundary wrapper
- Consider virtual list for large message counts

**Backend (6 issues)**
- Add Zod validation for request body
- Implement rate limiting (20 req/min suggested)
- Standardize API response format
- Add structured logging
- Add security headers

**Architecture (3 issues)**
- Remove unused `@anthropic-ai/sdk` dependency
- Split large Chat component into subcomponents
- Add TypeScript types for API responses

**Deployment (3 issues)**
- Add security and cache headers in `next.config.mjs`
- Add bundle analyzer for optimization insights
- Add environment variable validation

The report includes complete code examples for each optimization. Would you like me to implement any of these changes?
