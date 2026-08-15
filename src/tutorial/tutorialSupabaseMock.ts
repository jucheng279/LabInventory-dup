import { TUTORIAL_BOX_ID } from './mockData';

type Row = Record<string, any>;

class QueryBuilder {
  private table: string;
  private store: Map<string, Row[]>;
  private filters: Array<{ type: string; column: string; value: any }> = [];
  private orderClauses: Array<{ column: string; ascending: boolean }> = [];
  private mode: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private payload: any = null;
  private conflictKey: string | null = null;
  private singleMode: 'single' | 'maybeSingle' | null = null;
  private columns: string = '*';
  private countMode: 'exact' | null = null;

  constructor(table: string, store: Map<string, Row[]>) {
    this.table = table;
    this.store = store;
    if (!store.has(table)) store.set(table, []);
  }

  select(columns?: string, opts?: { count?: 'exact' }) {
    if (this.mode !== 'insert' && this.mode !== 'upsert') {
      this.mode = 'select';
    }
    if (columns) this.columns = columns;
    if (opts?.count) this.countMode = opts.count;
    return this;
  }

  insert(rows: Row | Row[]) {
    this.mode = 'insert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.mode = 'upsert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.conflictKey = opts?.onConflict ?? 'id';
    return this;
  }

  update(data: Row) {
    this.mode = 'update';
    this.payload = data;
    return this;
  }

  delete() {
    this.mode = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ type: 'neq', column, value });
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push({ type: 'in', column, value: values });
    return this;
  }

  is(column: string, value: any) {
    this.filters.push({ type: 'is', column, value });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderClauses.push({ column, ascending: opts?.ascending ?? true });
    return this;
  }

  range(_from: number, _to: number) {
    return this;
  }

  limit(_count: number) {
    return this;
  }

  single() {
    this.singleMode = 'single';
    return this;
  }

  maybeSingle() {
    this.singleMode = 'maybeSingle';
    return this;
  }

  private applyFilters(rows: Row[]): Row[] {
    let result = rows;
    for (const f of this.filters) {
      switch (f.type) {
        case 'eq':
          result = result.filter(r => r[f.column] === f.value);
          break;
        case 'neq':
          result = result.filter(r => r[f.column] !== f.value);
          break;
        case 'in':
          result = result.filter(r => (f.value as any[]).includes(r[f.column]));
          break;
        case 'is':
          result = result.filter(r => r[f.column] === f.value);
          break;
      }
    }
    return result;
  }

  private applyOrder(rows: Row[]): Row[] {
    if (this.orderClauses.length === 0) return rows;
    return [...rows].sort((a, b) => {
      for (const { column, ascending } of this.orderClauses) {
        const av = a[column];
        const bv = b[column];
        if (av < bv) return ascending ? -1 : 1;
        if (av > bv) return ascending ? 1 : -1;
      }
      return 0;
    });
  }

  private generateId(): string {
    return 'tutorial-' + Math.random().toString(36).slice(2, 11);
  }

  then(resolve: (result: any) => void, reject?: (err: any) => void): void {
    try {
      resolve(this.execute());
    } catch (e) {
      if (reject) reject(e);
    }
  }

  private execute(): { data: any; error: null; count?: number } {
    const tableRows = this.store.get(this.table) || [];

    switch (this.mode) {
      case 'select': {
        let result = this.applyFilters(tableRows);
        result = this.applyOrder(result);
        if (this.singleMode === 'single') {
          return { data: result[0] || null, error: null };
        }
        if (this.singleMode === 'maybeSingle') {
          return { data: result[0] || null, error: null };
        }
        if (this.countMode === 'exact') {
          return { data: result, error: null, count: result.length };
        }
        return { data: result, error: null };
      }

      case 'insert': {
        const now = new Date().toISOString();
        const inserted = (this.payload as Row[]).map(row => {
          let id = row.id || this.generateId();
          if (this.table === 'boxes' && !row.id && tableRows.length === 0) {
            id = TUTORIAL_BOX_ID;
          }
          return { created_at: now, updated_at: now, ...row, id };
        });
        tableRows.push(...inserted);
        this.store.set(this.table, tableRows);

        if (this.table === 'boxes') {
          const statsRows = this.store.get('boxes_with_stats') || [];
          for (const box of inserted) {
            const totalCells = (box.rows || 8) * (box.columns || 12);
            statsRows.push({
              ...box,
              filled_cells: 0,
              total_cells: totalCells,
              utilization_percent: 0,
            });
          }
          this.store.set('boxes_with_stats', statsRows);
        }

        if (this.singleMode === 'single' || this.singleMode === 'maybeSingle') {
          return { data: inserted[0] || null, error: null };
        }
        if (this.columns !== '*' || this.singleMode) {
          return { data: inserted[0] || null, error: null };
        }
        return { data: inserted, error: null };
      }

      case 'upsert': {
        const now = new Date().toISOString();
        const conflictKeys = (this.conflictKey || 'id').split(',');
        for (const row of this.payload as Row[]) {
          const existingIdx = tableRows.findIndex(existing =>
            conflictKeys.every(key => existing[key.trim()] === row[key.trim()])
          );
          if (existingIdx >= 0) {
            tableRows[existingIdx] = { ...tableRows[existingIdx], ...row, updated_at: now };
          } else {
            tableRows.push({ id: row.id || this.generateId(), created_at: now, updated_at: now, ...row });
          }
        }
        this.store.set(this.table, tableRows);
        return { data: this.payload, error: null };
      }

      case 'update': {
        const now = new Date().toISOString();
        const filtered = this.applyFilters(tableRows);
        const filteredIds = new Set(filtered.map(r => r.id));
        const updated: Row[] = [];
        const newTable = tableRows.map(row => {
          if (filteredIds.has(row.id)) {
            const merged = { ...row, ...this.payload, updated_at: now };
            updated.push(merged);
            return merged;
          }
          return row;
        });
        this.store.set(this.table, newTable);

        if (this.singleMode === 'single' || this.singleMode === 'maybeSingle') {
          return { data: updated[0] || null, error: null };
        }
        return { data: updated, error: null };
      }

      case 'delete': {
        const filtered = this.applyFilters(tableRows);
        const deleteIds = new Set(filtered.map(r => r.id));
        this.store.set(this.table, tableRows.filter(r => !deleteIds.has(r.id)));
        return { data: filtered, error: null };
      }
    }
  }
}

export class TutorialSupabaseMock {
  private store: Map<string, Row[]>;

  constructor(seedData?: Record<string, Row[]>) {
    this.store = new Map();
    if (seedData) {
      for (const [table, rows] of Object.entries(seedData)) {
        this.store.set(table, [...rows]);
      }
    }
  }

  from(table: string): QueryBuilder {
    return new QueryBuilder(table, this.store);
  }

  rpc(_name: string, _params?: any): Promise<{ data: any; error: null }> {
    return Promise.resolve({ data: null, error: null });
  }

  get storage() {
    return {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
        remove: () => Promise.resolve({ data: null, error: null }),
      }),
    };
  }

  destroy() {
    this.store.clear();
  }
}
