"use client";

import { auth, db, isFirebaseConfigured, storage } from "@/lib/firebase";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { ChevronRight, ImagePlus, Loader2, LogOut, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

type AdminStatus = "checking" | "signed-out" | "checking-role" | "admin" | "denied" | "unconfigured";
type FieldType = "text" | "textarea" | "number" | "checkbox" | "date" | "tags" | "image";
type AdminDoc = Record<string, unknown> & { id: string };

type FieldConfig = {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  placeholder?: string;
  uploadFolder?: string;
};

type CollectionConfig = {
  key: AdminSection;
  label: string;
  collectionName: string;
  fields: FieldConfig[];
  previewFields: string[];
};

type AdminSection =
  | "dashboard"
  | "articles"
  | "players"
  | "teams"
  | "rankings"
  | "media";

const navigation: Array<{ key: AdminSection; label: string }> = [
  { key: "dashboard", label: "Dashboard" },
  { key: "articles", label: "Articles" },
  { key: "players", label: "Players" },
  { key: "teams", label: "Teams" },
  { key: "rankings", label: "Rankings" },
  { key: "media", label: "Media" },
];

const commonPublishedField: FieldConfig = { name: "published", label: "Published", type: "checkbox" };

const collectionConfigs: CollectionConfig[] = [
  {
    key: "players",
    label: "Players",
    collectionName: "players",
    previewFields: ["school", "position", "level"],
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "slug", label: "Slug", required: true },
      { name: "photoUrl", label: "Player photo", type: "image", uploadFolder: "players" },
      { name: "school", label: "School" },
      { name: "city", label: "City" },
      { name: "state", label: "State" },
      { name: "classYear", label: "Class year" },
      { name: "position", label: "Position" },
      { name: "height", label: "Height" },
      { name: "level", label: "Level" },
      { name: "division", label: "Division" },
      { name: "ranking", label: "Ranking", type: "number" },
      { name: "bio", label: "Bio", type: "textarea" },
      { name: "socialLinks", label: "Social links", type: "textarea", placeholder: "One link per line" },
      commonPublishedField,
    ],
  },
  {
    key: "teams",
    label: "Teams",
    collectionName: "teams",
    previewFields: ["division", "conference", "record"],
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "slug", label: "Slug", required: true },
      { name: "logoUrl", label: "Team logo", type: "image", uploadFolder: "teams" },
      { name: "city", label: "City" },
      { name: "state", label: "State" },
      { name: "division", label: "Division" },
      { name: "conference", label: "Conference" },
      { name: "website", label: "Website" },
      { name: "ranking", label: "Ranking", type: "number" },
      { name: "record", label: "Record" },
      commonPublishedField,
    ],
  },
  {
    key: "rankings",
    label: "Rankings",
    collectionName: "rankings",
    previewFields: ["level", "division", "ranking"],
    fields: [
      { name: "title", label: "Title", required: true },
      { name: "slug", label: "Slug", required: true },
      { name: "level", label: "Level" },
      { name: "division", label: "Division" },
      { name: "category", label: "Category" },
      { name: "ranking", label: "Ranking", type: "number" },
      { name: "body", label: "Notes", type: "textarea" },
      commonPublishedField,
    ],
  },
  {
    key: "articles",
    label: "Articles",
    collectionName: "articles",
    previewFields: ["category", "author", "published"],
    fields: [
      { name: "title", label: "Title", required: true },
      { name: "slug", label: "Slug", required: true },
      { name: "excerpt", label: "Excerpt", type: "textarea" },
      { name: "body", label: "Body", type: "textarea", required: true },
      { name: "featuredImageUrl", label: "Featured image", type: "image", uploadFolder: "articles" },
      { name: "category", label: "Category" },
      { name: "tags", label: "Tags", type: "tags", placeholder: "JUCO, Recruiting, Spotlight" },
      { name: "author", label: "Author" },
      commonPublishedField,
      { name: "publishedAt", label: "Published date", type: "date" },
    ],
  },
  {
    key: "media",
    label: "Media",
    collectionName: "media",
    previewFields: ["type", "category", "published"],
    fields: [
      { name: "title", label: "Title", required: true },
      { name: "slug", label: "Slug", required: true },
      { name: "fileUrl", label: "Media file", type: "image", uploadFolder: "media" },
      { name: "type", label: "Type" },
      { name: "category", label: "Category" },
      { name: "altText", label: "Alt text" },
      { name: "caption", label: "Caption", type: "textarea" },
      { name: "tags", label: "Tags", type: "tags", placeholder: "photo, player, game night" },
      commonPublishedField,
    ],
  },
];

const editableConfigs = collectionConfigs;

function getTitle(docData: AdminDoc) {
  return String(docData.title || docData.name || docData.subjectName || docData.slug || "Untitled");
}

function fieldValueToString(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return "";
}

function parseValue(field: FieldConfig, formData: FormData) {
  if (field.type === "checkbox") return formData.get(field.name) === "on";
  const rawValue = String(formData.get(field.name) || "").trim();
  if (field.type === "number") return rawValue ? Number(rawValue) : null;
  if (field.type === "tags") return rawValue.split(",").map((tag) => tag.trim()).filter(Boolean);
  return rawValue;
}

export function AdminDashboard() {
  const [authStatus, setAuthStatus] = useState<AdminStatus>(isFirebaseConfigured ? "checking" : "unconfigured");
  const [user, setUser] = useState<User | null>(null);
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");
  const router = useRouter();

  useEffect(() => {
    const activeAuth = auth;
    const activeDb = db;
    if (!activeAuth || !activeDb) return;
    return onAuthStateChanged(activeAuth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setAuthStatus("signed-out");
        router.replace("/admin/login");
        return;
      }

      setAuthStatus("checking-role");
      try {
        const userSnapshot = await getDoc(doc(activeDb, "users", nextUser.uid));
        setAuthStatus(userSnapshot.exists() && userSnapshot.data().role === "admin" ? "admin" : "denied");
      } catch {
        setAuthStatus("denied");
      }
    });
  }, [router]);

  if (authStatus === "unconfigured") return <AdminShell><AdminMessage title="Firebase is not configured" body="Add the Firebase environment variables before using the admin dashboard." /></AdminShell>;
  if (authStatus === "checking" || authStatus === "checking-role") return <AdminShell><AdminLoading label={authStatus === "checking-role" ? "Checking admin access" : "Checking session"} /></AdminShell>;
  if (authStatus === "signed-out") return <AdminShell><AdminLoading label="Redirecting to login" /></AdminShell>;
  if (authStatus === "denied") return <AdminShell><AccessDenied user={user} /></AdminShell>;

  const activeConfig = editableConfigs.find((config) => config.key === activeSection);

  return (
    <div className="min-h-screen bg-zinc-950 pt-20 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 lg:flex-row lg:px-8">
        <aside className="lg:w-72">
          <div className="border border-white/10 bg-black p-4">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-red-500">Hoop Frens Admin</p>
            <p className="mt-2 text-sm font-bold text-zinc-400">{user?.email}</p>
            <button onClick={() => auth && signOut(auth)} className="mt-4 inline-flex items-center gap-2 text-xs font-black uppercase text-zinc-300 hover:text-white">
              <LogOut size={15} />
              Sign out
            </button>
          </div>
          <nav className="mt-4 grid gap-2">
            {navigation.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                className={`flex items-center justify-between border px-4 py-3 text-left text-sm font-black uppercase transition ${activeSection === item.key ? "border-red-600 bg-red-600 text-white" : "border-white/10 bg-black text-zinc-400 hover:border-white/25 hover:text-white"}`}
              >
                {item.label}
                <ChevronRight size={16} />
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 flex-1">
          {activeSection === "dashboard" ? <DashboardHome /> : null}
          {activeConfig ? <CollectionManager config={activeConfig} /> : null}
        </section>
      </div>
    </div>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-zinc-950 px-5 pt-28 text-white">{children}</div>;
}

function AdminLoading({ label }: { label: string }) {
  return <div className="mx-auto flex max-w-md items-center gap-3 border border-white/10 bg-black p-6 text-sm font-black uppercase text-zinc-300"><Loader2 className="animate-spin text-red-500" size={20} />{label}</div>;
}

function AdminMessage({ title, body }: { title: string; body: string }) {
  return <div className="mx-auto max-w-xl border border-white/10 bg-black p-8"><h1 className="text-3xl font-black uppercase">{title}</h1><p className="mt-4 leading-7 text-zinc-400">{body}</p></div>;
}

function AccessDenied({ user }: { user: User | null }) {
  return (
    <div className="mx-auto max-w-xl border border-red-600/40 bg-black p-8">
      <ShieldAlert className="text-red-500" size={34} />
      <h1 className="mt-4 text-4xl font-black uppercase">Access denied.</h1>
      <p className="mt-4 leading-7 text-zinc-400">{user?.email || "This user"} is authenticated but does not have an admin role.</p>
    </div>
  );
}

function DashboardHome() {
  const [docsByCollection, setDocsByCollection] = useState<Record<string, AdminDoc[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCounts() {
      const activeDb = db;
      if (!activeDb) return;
      setLoading(true);
      const nextDocs: Record<string, AdminDoc[]> = {};
      await Promise.all(editableConfigs.map(async (config) => {
        const snapshot = await getDocs(collection(activeDb, config.collectionName));
        nextDocs[config.collectionName] = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      }));
      setDocsByCollection(nextDocs);
      setLoading(false);
    }
    loadCounts().catch(() => setLoading(false));
  }, []);

  const articles = docsByCollection.articles || [];
  const stats = [
    { label: "Articles", value: articles.length },
    { label: "Players", value: docsByCollection.players?.length || 0 },
    { label: "Teams", value: docsByCollection.teams?.length || 0 },
    { label: "Rankings", value: docsByCollection.rankings?.length || 0 },
    { label: "Media", value: docsByCollection.media?.length || 0 },
  ];

  return (
    <div>
      <HeaderBlock eyebrow="Dashboard" title="Command center" description="Track content inventory across Hoop Frens editorial, rankings, teams, and player coverage." />
      {loading ? <AdminLoading label="Loading dashboard" /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{stats.map((stat) => <SummaryCard key={stat.label} {...stat} />)}</div>}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <div className="border border-white/10 bg-black p-6"><p className="text-xs font-black uppercase tracking-widest text-zinc-500">{label}</p><p className="mt-4 text-5xl font-black text-white">{value}</p></div>;
}

function CollectionManager({ config }: { config: CollectionConfig }) {
  const [items, setItems] = useState<AdminDoc[]>([]);
  const [editingItem, setEditingItem] = useState<AdminDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadItems = useCallback(async () => {
    const activeDb = db;
    if (!activeDb) return;
    setLoading(true);
    const snapshot = await getDocs(query(collection(activeDb, config.collectionName), orderBy("updatedAt", "desc")));
    setItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    setLoading(false);
  }, [config.collectionName]);

  useEffect(() => {
    void Promise.resolve().then(loadItems).catch(() => {
      setMessage("Could not load this collection.");
      setLoading(false);
    });
  }, [loadItems]);

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db) return;
    setSaving(true);
    setMessage("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = config.fields.reduce<Record<string, unknown>>((currentPayload, field) => {
      currentPayload[field.name] = parseValue(field, formData);
      return currentPayload;
    }, {});

    const missingRequired = config.fields.some((field) => field.required && !payload[field.name]);
    if (missingRequired) {
      setSaving(false);
      setMessage("Complete the required fields.");
      return;
    }

    try {
      if (editingItem) {
        await updateDoc(doc(db, config.collectionName, editingItem.id), { ...payload, updatedAt: serverTimestamp() });
        setMessage(`${config.label} item updated.`);
      } else {
        await addDoc(collection(db, config.collectionName), { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        setMessage(`${config.label} item created.`);
      }
      form.reset();
      setEditingItem(null);
      await loadItems();
    } catch {
      setMessage("Could not save this item.");
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(item: AdminDoc) {
    if (!db) return;
    const confirmed = window.confirm(`Delete ${getTitle(item)}?`);
    if (!confirmed) return;
    await deleteDoc(doc(db, config.collectionName, item.id));
    await loadItems();
  }

  return (
    <div>
      <HeaderBlock eyebrow="Content manager" title={config.label} description={`Create, update, publish, and organize ${config.label.toLowerCase()} records.`} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="border border-white/10 bg-black">
          <div className="border-b border-white/10 px-5 py-4 text-sm font-black uppercase text-zinc-300">{loading ? "Loading..." : `${items.length} items`}</div>
          <div className="divide-y divide-white/10">
            {items.map((item) => (
              <div key={item.id} className="grid gap-3 p-5 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <h3 className="text-xl font-black uppercase text-white">{getTitle(item)}</h3>
                  <p className="mt-2 text-sm text-zinc-500">{config.previewFields.map((field) => fieldValueToString(item[field])).filter(Boolean).join(" / ") || item.id}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingItem(item)} className="rounded-md border border-white/15 px-4 py-2 text-xs font-black uppercase text-white hover:border-red-500">Edit</button>
                  <button onClick={() => removeItem(item)} className="rounded-md bg-red-600 px-4 py-2 text-xs font-black uppercase text-white hover:bg-red-500">Delete</button>
                </div>
              </div>
            ))}
            {!loading && items.length === 0 ? <p className="p-5 text-sm font-bold text-zinc-500">No records yet.</p> : null}
          </div>
        </div>
        <form onSubmit={saveItem} className="grid gap-4 border border-white/10 bg-black p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black uppercase">{editingItem ? "Edit item" : "New item"}</h3>
            {editingItem ? <button type="button" onClick={() => setEditingItem(null)} className="text-xs font-black uppercase text-zinc-400 hover:text-white">Clear</button> : null}
          </div>
          {config.fields.map((field) => <AdminField key={`${editingItem?.id || "new"}-${field.name}`} field={field} item={editingItem} />)}
          <button disabled={saving} className="rounded-lg bg-red-600 px-5 py-4 text-sm font-black uppercase text-white hover:bg-red-500 disabled:opacity-60">{saving ? "Saving..." : editingItem ? "Update" : "Create"}</button>
          {message ? <p role="status" className="text-sm font-bold text-yellow-400">{message}</p> : null}
        </form>
      </div>
    </div>
  );
}

function AdminField({ field, item }: { field: FieldConfig; item: AdminDoc | null }) {
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState(fieldValueToString(item?.[field.name]));

  async function uploadFile(file: File) {
    if (!storage) return;
    setUploading(true);
    const storageRef = ref(storage, `admin/${field.uploadFolder || "uploads"}/${Date.now()}-${file.name}`);
    await uploadBytes(storageRef, file);
    setImageUrl(await getDownloadURL(storageRef));
    setUploading(false);
  }

  if (field.type === "checkbox") {
    return <label className="flex items-center gap-3 text-sm font-black uppercase text-zinc-300"><input name={field.name} type="checkbox" defaultChecked={Boolean(item?.[field.name])} className="size-4 accent-red-600" />{field.label}</label>;
  }

  if (field.type === "textarea") {
    return <label className="form-label">{field.label}<textarea name={field.name} required={field.required} rows={5} defaultValue={fieldValueToString(item?.[field.name])} placeholder={field.placeholder} className="form-field mt-2 resize-y" /></label>;
  }

  if (field.type === "image") {
    return (
      <label className="form-label">
        {field.label}
        <input name={field.name} value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://" className="form-field mt-2" />
        <span className="mt-2 flex items-center gap-2">
          <input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && uploadFile(event.target.files[0])} className="w-full text-sm text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-red-600 file:px-3 file:py-2 file:text-xs file:font-black file:uppercase file:text-white" />
          {uploading ? <Loader2 className="animate-spin text-red-500" size={18} /> : <ImagePlus className="text-zinc-500" size={18} />}
        </span>
      </label>
    );
  }

  return <label className="form-label">{field.label}<input name={field.name} type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} required={field.required} defaultValue={fieldValueToString(item?.[field.name])} placeholder={field.placeholder} className="form-field mt-2" /></label>;
}

function HeaderBlock({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-red-500">{eyebrow}</p>
      <h1 className="mt-2 text-4xl font-black uppercase tracking-tight text-white sm:text-5xl">{title}</h1>
      <p className="mt-3 max-w-2xl leading-7 text-zinc-400">{description}</p>
    </div>
  );
}
