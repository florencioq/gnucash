import { useEffect, useState } from "react";
import { api } from "../api/client.js";

export default function useActiveBook() {
  const [activeBook, setActiveBook] = useState(null);
  const [activeBookError, setActiveBookError] = useState(null);

  const loadActiveBook = async () => {
    const response = await api.get("/books/active");
    if (!response.ok) {
      if (response.error?.code === "ACTIVE_BOOK_NOT_FOUND") {
        setActiveBook(null);
        setActiveBookError(null);
        return null;
      }
      setActiveBook(null);
      setActiveBookError(response.error);
      return null;
    }
    setActiveBookError(null);
    setActiveBook(response.data);
    return response.data;
  };

  useEffect(() => {
    loadActiveBook();
  }, []);

  return {
    activeBook,
    activeBookId: activeBook?.id || "",
    activeBookError,
    loadActiveBook
  };
}
