# MUST Handbook App - Project Review

**Date:** April 5, 2026  
**Reviewer:** AI Assistant

---

## Executive Summary

This is a React Native (Expo) mobile application with a FastAPI backend that provides a RAG-powered semantic search system for the MUST (ШУТИС) Student Handbook. The app features an AI chatbot, onboarding flow, and handbook browsing capabilities.

---

## Architecture Overview

### Frontend Stack
- **Framework:** Expo SDK ~52.0.0 with React Native 0.76.5
- **Routing:** Expo Router 4.0.0 (file-based routing)
- **Styling:** NativeWind (Tailwind CSS for React Native)
- **Animations:** Moti + React Native Reanimated
- **State:** React Context (BookmarkProvider)
- **Fonts:** @expo-google-fonts/inter

### Backend Stack
- **Framework:** FastAPI with async lifespan management
- **RAG Engine:** FAISS + sentence-transformers
- **AI Integration:** Google Gemini (models/gemini-2.5-flash)
- **Data Sources:** PDF processor, web scraper, static resources
- **Caching:** JSON-based cache for PDFs and web content

---

## Code Quality Assessment

### Strengths

1. **Well-structured project layout**
   - Clear separation between `app/`, `backend/`, `components/`, `services/`
   - Follows Expo Router conventions properly

2. **Robust onboarding flow** (`app/onboarding.tsx`)
   - Proper error boundary for Lottie animations
   - Animated transitions with native driver performance
   - Handles both "skip once" and "never show again" flows
   - Android hardware back button handling

3. **Production-ready backend** (`backend/main.py`)
   - Async/await patterns throughout
   - Background sync without blocking startup
   - Concurrent sync protection with locks
   - Comprehensive health endpoint

4. **Cost-conscious AI implementation**
   - Short system prompt to reduce token costs
   - Casual message detection to skip RAG for simple greetings
   - History capped at 6 turns
   - Truncated context (400 chars per chunk)

5. **Thoughtful UX details**
   - Haptic feedback on tabs
   - Skeleton loaders for loading states
   - Dark mode support throughout
   - Error boundaries for crash recovery

### Areas for Improvement

1. **TypeScript Coverage**
   - `onboarding.tsx:1` mixes class components (ErrorBoundary) with functional components inconsistently
   - Some `any` types in navigation and icon props
   - `CategoryCard.tsx:67` casts icon as `any` instead of proper MaterialIcons type

2. **Error Handling**
   - Chat endpoint catches exceptions but returns generic messages
   - No retry logic for failed API calls in frontend
   - Silent failures in background sync (errors logged but not surfaced to user)

3. **Security Concerns**
   - CORS allows all origins (`*`) - should be restricted to app scheme in production
   - API keys loaded from environment but no validation at startup
   - No rate limiting on chat endpoint

4. **Performance Opportunities**
   - Lottie components loaded dynamically on every slide render
   - No memoization on CategoryCard components
   - FlatList in onboarding could use `getItemLayout` for optimization

5. **Testing Gaps**
   - No test files found in project
   - No E2E testing setup
   - Backend has no unit tests for RAG service

6. **Documentation**
   - SETUP.md is minimal
   - No API documentation beyond inline comments
   - Missing troubleshooting guide

---

## File-by-File Notes

### `app/_layout.tsx`
- Clean root layout with proper splash screen handling
- Good use of `BookmarkProvider` context wrapper
- Consider adding error boundary at root level

### `app/onboarding.tsx`
- Well-commented code with clear intent
- Line 97: `skipOnce()` sets flag but shouldn't - comment says "still set for this session to avoid loop" but this defeats the purpose
- Consider extracting slide data to separate constants file

### `backend/main.py`
- Line 295-306: Gemini client initialization is lazy but could fail silently
- Line 383-385: Error detection via string matching ("429", "quota") is fragile
- Line 557-572: Local summarizer is extractive only - clearly marked for replacement

### `components/CategoryCard.tsx`
- Good use of `useRef` for animation persistence
- Consider `React.memo` wrapper for list rendering performance
- Icon type should be `MaterialIcons` instead of `any`

---

## Recommendations

### Immediate (Pre-Launch)
1. Add API key validation at backend startup
2. Restrict CORS to specific origins
3. Add basic unit tests for critical paths
4. Implement retry logic in frontend services

### Short-term (Post-Launch)
1. Replace local summarizer with production LLM
2. Add comprehensive error tracking (Sentry)
3. Implement proper rate limiting
4. Add analytics for user behavior tracking

### Long-term
1. Consider migrating from JSON cache to proper database (SQLite/PostgreSQL)
2. Implement incremental FAISS index updates
3. Add A/B testing framework for onboarding optimization
4. Consider code splitting for web bundle optimization

---

## Conclusion

This is a well-architected graduation project with solid fundamentals. The RAG implementation is production-ready, and the frontend shows attention to UX detail. Main gaps are in testing, error handling, and security hardening. With focused improvements in these areas, this could serve as a production system for MUST.

**Overall Grade:** A- (Strong graduation project with production potential)
