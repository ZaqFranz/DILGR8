import { apiRequest } from "@/shared/api/apiClient";
import type { Category, CreateCategoryInput, UpdateCategoryInput } from "../types";

export function listCategories(): Promise<Category[]> {
  return apiRequest<Category[]>("/categories");
}

export function createCategory(input: CreateCategoryInput): Promise<Category> {
  return apiRequest<Category>("/categories", { method: "POST", body: input });
}

export function updateCategory(id: string, input: UpdateCategoryInput): Promise<Category> {
  return apiRequest<Category>(`/categories/${id}`, { method: "PATCH", body: input });
}

export function deleteCategory(id: string): Promise<void> {
  return apiRequest<void>(`/categories/${id}`, { method: "DELETE" });
}
