import React, { createContext, useContext, useState } from 'react';

interface BookmarkContextType {
  bookmarks: Set<string>;
  toggle: (id: string) => void;
  isBookmarked: (id: string) => boolean;
}

const BookmarkContext = createContext<BookmarkContextType>({
  bookmarks: new Set(),
  toggle: () => {},
  isBookmarked: () => false,
});

export function BookmarkProvider({ children }: { children: React.ReactNode }) {
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isBookmarked = (id: string) => bookmarks.has(id);

  return (
    <BookmarkContext.Provider value={{ bookmarks, toggle, isBookmarked }}>
      {children}
    </BookmarkContext.Provider>
  );
}

export const useBookmarks = () => useContext(BookmarkContext);
