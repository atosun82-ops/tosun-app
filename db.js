const DB_NAME = "tosun_attendance_db";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains("employees")) {
        const s = db.createObjectStore("employees", { keyPath: "id", autoIncrement: true });
        s.createIndex("name", "name", { unique: false });
      }

      if (!db.objectStoreNames.contains("entries")) {
        const s = db.createObjectStore("entries", { keyPath: "id", autoIncrement: true });
        s.createIndex("by_employee_date", ["employeeId", "date"], { unique: true });
        s.createIndex("by_employee", "employeeId", { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(storeNames, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeNames, mode);
    const stores = {};
    storeNames.forEach(n => stores[n] = t.objectStore(n));
    let result;
    Promise.resolve(fn(stores)).then(r => { result = r; }).catch(reject);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function seedIfEmpty() {
  const count = await tx(["employees"], "readonly", ({employees}) =>
    new Promise((res, rej) => {
      const req = employees.count();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    })
  );
  if (count > 0) return;

  await tx(["employees"], "readwrite", ({employees}) => {
    for (let i = 1; i <= 8; i++) employees.add({ name: `Mitarbeiter ${i}`, rate: 120 });
  });
}

export async function listEmployees() {
  return tx(["employees"], "readonly", ({employees}) =>
    new Promise((res, rej) => {
      const req = employees.getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    })
  );
}

export async function addEmployee(name, rate) {
  return tx(["employees"], "readwrite", ({employees}) =>
    new Promise((res, rej) => {
      const req = employees.add({ name, rate });
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    })
  );
}

export async function updateEmployee(emp) {
  return tx(["employees"], "readwrite", ({employees}) => employees.put(emp));
}

export async function deleteEmployee(id) {
  return tx(["employees","entries"], "readwrite", ({employees, entries}) => {
    employees.delete(id);
    const idx = entries.index("by_employee");
    idx.openCursor(IDBKeyRange.only(id)).onsuccess = (e) => {
      const c = e.target.result;
      if (c) { entries.delete(c.primaryKey); c.continue(); }
    };
  });
}

function iso(d){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const da=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${da}`;
}

export async function upsertEntry(employeeId, dateIso, present, payment) {
  return tx(["entries"], "readwrite", ({entries}) =>
    new Promise((res, rej) => {
      const idx = entries.index("by_employee_date");
      const getReq = idx.get([employeeId, dateIso]);
      getReq.onsuccess = () => {
        const ex = getReq.result;
        if (ex) {
          ex.present = !!present;
          ex.payment = Number(payment || 0);
          entries.put(ex);
          res(ex.id);
        } else {
          const addReq = entries.add({ employeeId, date: dateIso, present: !!present, payment: Number(payment||0) });
          addReq.onsuccess = () => res(addReq.result);
          addReq.onerror = () => rej(addReq.error);
        }
      };
      getReq.onerror = () => rej(getReq.error);
    })
  );
}

export async function listEntriesForEmployeeInMonth(employeeId, year, month) {
  const start = iso(new Date(year, month-1, 1));
  const end = iso(new Date(year, month, 1));
  return tx(["entries"], "readonly", ({entries}) =>
    new Promise((res, rej) => {
      const idx = entries.index("by_employee");
      const req = idx.getAll(IDBKeyRange.only(employeeId));
      req.onsuccess = () => res((req.result||[]).filter(e => e.date >= start && e.date < end));
      req.onerror = () => rej(req.error);
    })
  );
}

export async function listEntriesForEmployeeInYear(employeeId, year) {
  const start = `${year}-01-01`;
  const end = `${year+1}-01-01`;
  return tx(["entries"], "readonly", ({entries}) =>
    new Promise((res, rej) => {
      const idx = entries.index("by_employee");
      const req = idx.getAll(IDBKeyRange.only(employeeId));
      req.onsuccess = () => res((req.result||[]).filter(e => e.date >= start && e.date < end));
      req.onerror = () => rej(req.error);
    })
  );
}
