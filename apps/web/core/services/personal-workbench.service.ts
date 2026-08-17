import { API_BASE_URL } from "@plane/constants";
import type {
  TPersonalWorkbenchCalendarItem,
  TPersonalWorkbenchConfig,
  TPersonalWorkbenchItem,
  TPersonalWorkbenchOption,
  TPersonalWorkbenchTable,
} from "@/types/personal-workbench";
import { APIService } from "@/services/api.service";

export class PersonalWorkbenchService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getConfig(): Promise<TPersonalWorkbenchConfig> {
    return this.get("/api/personal-workbench/").then((response) => response.data);
  }

  async getItems(section: string): Promise<TPersonalWorkbenchItem[]> {
    return this.get("/api/personal-workbench/items/", { params: { section } }).then((response) => response.data);
  }

  async getCalendarItems(): Promise<TPersonalWorkbenchCalendarItem[]> {
    return this.get("/api/personal-workbench/calendar/").then((response) => response.data);
  }

  async updateFieldOptions(
    tableId: string,
    fieldId: string,
    options: TPersonalWorkbenchOption[]
  ): Promise<TPersonalWorkbenchTable> {
    return this.patch(`/api/personal-workbench/tables/${tableId}/fields/${fieldId}/options/`, { options }).then(
      (response) => response.data
    );
  }

  async createItem(section: string, values: Record<string, unknown>): Promise<TPersonalWorkbenchItem> {
    return this.post("/api/personal-workbench/items/", { section, values }).then((response) => response.data);
  }

  async updateItem(id: string, values: Record<string, unknown>): Promise<TPersonalWorkbenchItem> {
    return this.patch(`/api/personal-workbench/items/${id}/`, { values }).then((response) => response.data);
  }

  async reorderItems(section: string, itemIds: string[]): Promise<TPersonalWorkbenchItem[]> {
    return this.patch("/api/personal-workbench/items/reorder/", { section, item_ids: itemIds }).then(
      (response) => response.data
    );
  }

  async deleteItem(id: string): Promise<void> {
    return this.delete(`/api/personal-workbench/items/${id}/`).then(() => undefined);
  }
}
