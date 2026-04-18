import React, { createContext, useContext, useState } from 'react';

export interface SavedNewsItem {
  id: number;
  title: string;
  cover_image_url: string | null;
  is_special: boolean;
  content: string | null;
  sections: { body: string }[];
  author_name: string | null;
  created_at: string;
}

interface BookmarkContextType {
  // Handbook bookmarks
  bookmarks: Set<string>;
  toggle: (id: string) => void;
  isBookmarked: (id: string) => boolean;
  // News bookmarks
  savedNews: Map<number, SavedNewsItem>;
  toggleNews: (item: SavedNewsItem) => void;
  isNewsSaved: (id: number) => boolean;
}

const BookmarkContext = createContext<BookmarkContextType>({
  bookmarks: new Set(),
  toggle: () => {},
  isBookmarked: () => false,
  savedNews: new Map(),
  toggleNews: () => {},
  isNewsSaved: () => false,
});

export function BookmarkProvider({ children }: { children: React.ReactNode }) {
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [savedNews, setSavedNews] = useState<Map<number, SavedNewsItem>>(new Map());

  const toggle = (id: string) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isBookmarked = (id: string) => bookmarks.has(id);

  const toggleNews = (item: SavedNewsItem) => {
    setSavedNews(prev => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });
  };

  const isNewsSaved = (id: number) => savedNews.has(id);

  return (
    <BookmarkContext.Provider value={{ bookmarks, toggle, isBookmarked, savedNews, toggleNews, isNewsSaved }}>
      {children}
    </BookmarkContext.Provider>
  );
}

export const useBookmarks = () => useContext(BookmarkContext);
