import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import X from "lucide-react/dist/esm/icons/x";
import Check from "lucide-react/dist/esm/icons/check";

export const Route = createFileRoute("/_authenticated/sample-crud")({
  head: () => ({
    meta: [
      { title: "Sample CRUD — Database Test" },
      { name: "description", content: "Verify Lovable Cloud database reads and writes with a sample notes table." },
    ],
  }),
  component: SampleCrudPage,
});

type Note = {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
  updated_at: string;
};

function SampleCrudPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const notesQuery = useQuery({
    queryKey: ["sample_notes", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Note[]> => {
      const { data, error } = await supabase
        .from("sample_notes" as never)
        .select("id, title, content, created_at, updated_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Note[];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("sample_notes" as never)
        .insert({ title: title.trim(), content: content.trim() || null, user_id: user.id } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setContent("");
      toast.success("Note created");
      qc.invalidateQueries({ queryKey: ["sample_notes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("sample_notes" as never)
        .update({ title: editTitle.trim(), content: editContent.trim() || null } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingId(null);
      toast.success("Note updated");
      qc.invalidateQueries({ queryKey: ["sample_notes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sample_notes" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note deleted");
      qc.invalidateQueries({ queryKey: ["sample_notes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (n: Note) => {
    setEditingId(n.id);
    setEditTitle(n.title);
    setEditContent(n.content ?? "");
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sample CRUD</h1>
        <p className="text-muted-foreground mt-1">
          Verifies database reads and writes against the <code>sample_notes</code> table (RLS-scoped to your account).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create note</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
          <Textarea
            placeholder="Content (optional)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
          />
          <Button
            onClick={() => createMut.mutate()}
            disabled={!title.trim() || createMut.isPending}
          >
            {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add note
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your notes {notesQuery.data && `(${notesQuery.data.length})`}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {notesQuery.isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}
          {notesQuery.error && (
            <p className="text-destructive text-sm">{(notesQuery.error as Error).message}</p>
          )}
          {notesQuery.data?.length === 0 && (
            <p className="text-muted-foreground text-sm">No notes yet — create one above.</p>
          )}
          {notesQuery.data?.map((n) => (
            <div key={n.id} className="rounded-lg border p-3">
              {editingId === n.id ? (
                <div className="space-y-2">
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                  <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={2} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateMut.mutate(n.id)} disabled={updateMut.isPending}>
                      <Check className="mr-1 h-4 w-4" /> Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      <X className="mr-1 h-4 w-4" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{n.title}</p>
                    {n.content && <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{n.content}</p>}
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(n.updated_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(n)} aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Delete this note?")) deleteMut.mutate(n.id);
                      }}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
