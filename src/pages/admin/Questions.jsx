import React, { useEffect, useMemo, useState, useRef } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { FolderPlus, Plus, Trash2, Pencil, Search, Upload, Image as ImageIcon, X } from "lucide-react";
import { loadSectionCards, saveSectionCards } from "@/lib/sectionCards";

const EXAM_TAGS = ["JEE Mains", "JEE Advanced", "MHT-CET", "NEET"];

const DEFAULT_FOLDER_SECTIONS = [];

const DIFFICULTIES = [
  { v: "easy", l: "Easy", color: "bg-green-100 text-green-800" },
  { v: "medium", l: "Medium", color: "bg-yellow-100 text-yellow-800" },
  { v: "hard", l: "Hard", color: "bg-red-100 text-red-800" },
];

const QUESTION_TYPES = [
  { v: "mcq_single", l: "Single Choice (MCQ)" },
  { v: "mcq_multi", l: "Multiple Choice" },
  { v: "true_false", l: "True/False" },
  { v: "numerical", l: "Numerical" },
  { v: "fill_blank", l: "Fill Blank" },
  { v: "short", l: "Short Answer" },
  { v: "long", l: "Long Answer" },
  { v: "file", l: "File Upload" },
];

const blankQuestion = () => ({
  title: "", description: "", image_url: "", subject: "Mathematics", chapter: "", topic: "", test_folder: "",
  difficulty: "medium", type: "mcq_single", tags: [], options: [ { key: "A", text: "" },
  { key: "B", text: "" },
  { key: "C", text: "" },
  { key: "D", text: "" },], correct_answer: null, explanation: "",
  marking_pattern: "positive_only", default_marks: 4.0, default_negative_marks: 0,
});

const blankFolder = () => ({
  folder_name: "",
  exam_name: "",
  description: "",
  class_level: "",
  exam_tag: "",
  exam_id: "",
  duration_minutes: 60,
  passing_marks: 0,
  allowed_tab_switches: 3,
  instructions: "Read each question carefully.",
  publish: false,
  webcam: true,
  randomize: false,
  tag_questions_to_folder: true,
  selected_question_ids: [],
  assigned_student_ids: [],
  auto_assign_class: false,
});

export default function Questions() {
  const [questionCount, setQuestionCount] = useState(0);
  const [activeTab, setActiveTab] = useState("content");
 
  const titleRef = useRef(null);
  const [folders, setFolders] = useState(() => loadSectionCards());
  const [allQuestions, setAllQuestions] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [meta, setMeta] = useState(null);
  
  // Dialog states
  const [openQuestion, setOpenQuestion] = useState(false);
  const [openFolder, setOpenFolder] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [editingFolderId, setEditingFolderId] = useState(null);
  
  // Form states
  const [questionForm, setQuestionForm] = useState(blankQuestion());
  const [folderForm, setFolderForm] = useState(blankFolder());
  
  // Question filter
  const [questionSearch, setQuestionSearch] = useState("");
  const [filterQuestionSubject, setFilterQuestionSubject] = useState("all");
  
  // Student filter
  const [studentSearch, setStudentSearch] = useState("");
  
  // Image upload
  const fileInputRef = useRef(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Folder section UI
  const [activeFolder, setActiveFolder] = useState(null);
  const [folderQuestionSelection, setFolderQuestionSelection] = useState({});

  const load = async () => {
    try {
      const questionsRes = await api.get("/questions", { params: { limit: 500 } }).catch(() => ({ data: { questions: [] } }));
      setAllQuestions(questionsRes.data?.questions || []);
      setAllStudents([]);
      setMeta({ subjects: [] });
    } catch (err) {
      console.error("Load error:", err);
      toast.error("Failed to load questions");
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    saveSectionCards(folders);
  }, [folders]);

  const folderCards = useMemo(() => {
    return (folders || []).map((folder) => ({
      ...folder,
      question_count: folder.question_ids?.length || folder.question_count || 0,
    }));
  }, [folders]);

  const activeFolderCard = activeFolder
    ? folders.find((folder) => folder.folder_name === activeFolder) || null
    : null;

  const currentFolderQuestions = activeFolderCard
    ? allQuestions.filter((q) => activeFolderCard.question_ids?.includes(q.id))
    : [];

  const unassignedQuestionsForFolder = activeFolderCard
    ? allQuestions.filter((q) => !activeFolderCard.question_ids?.includes(q.id))
    : [];

  const selectedFolderQuestionIds = activeFolder ? (folderQuestionSelection[activeFolder] || []) : [];

  const syncFolderQuestionAssignments = (folderName, selectedIds, previousIds = []) => {
    const nextIds = Array.isArray(selectedIds) ? selectedIds : [];
    const previous = Array.isArray(previousIds) ? previousIds : [];
    setAllQuestions((prev) =>
      prev.map((question) => {
        const isSelected = nextIds.includes(question.id);
        const wasPrevious = previous.includes(question.id);
        if (isSelected) {
          return { ...question, test_folder: folderName };
        }
        if (wasPrevious && !isSelected) {
          return { ...question, test_folder: "" };
        }
        return question;
      })
    );
  };

  const toggleFolderQuestionSelection = (folderName, questionId) => {
    setFolderQuestionSelection((prev) => {
      const currentIds = prev[folderName] || [];
      const nextIds = currentIds.includes(questionId)
        ? currentIds.filter((id) => id !== questionId)
        : [...currentIds, questionId];
      return { ...prev, [folderName]: nextIds };
    });
  };

  const addQuestionsToFolder = async (folderName) => {
    const ids = folderQuestionSelection[folderName] || [];
    if (!ids.length) {
      toast.info("Select at least one unassigned question to add");
      return;
    }

    const previousFolder = folders.find((folder) => folder.folder_name === folderName);
    const previousIds = previousFolder?.question_ids || [];
    const mergedIds = Array.from(new Set([...(previousIds || []), ...ids]));

    setFolders((prev) => prev.map((folder) => {
      if (folder.folder_name !== folderName) return folder;
      return { ...folder, question_ids: mergedIds };
    }));

    syncFolderQuestionAssignments(folderName, mergedIds, previousIds);
    setFolderQuestionSelection((prev) => ({ ...prev, [folderName]: [] }));
    toast.success(`Added ${ids.length} question(s) to ${folderName}`);
  };

  const removeQuestionFromFolder = async (folderName, questionId) => {
    const previousFolder = folders.find((folder) => folder.folder_name === folderName);
    const previousIds = previousFolder?.question_ids || [];
    const nextIds = previousIds.filter((id) => id !== questionId);

    setFolders((prev) => prev.map((folder) => {
      if (folder.folder_name !== folderName) return folder;
      return {
        ...folder,
        question_ids: nextIds,
      };
    }));
    syncFolderQuestionAssignments(folderName, nextIds, previousIds);
    toast.success("Question moved to unassigned");
  };

  // ====== QUESTION FUNCTIONS ======
  const uploadImage = async (file) => {
    if (!file) return;
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/questions/upload-image", fd);
      setQuestionForm({ ...questionForm, image_url: data.image_url });
      setImagePreview(data.image_url);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleImageDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) uploadImage(files[0]);
  };

  const submitQuestion = async (closeAfterSave = true) => {
    try {
      if (!questionForm.title.trim()) {
        toast.error("Question title is required");
        return;
      }
      if (!questionForm.subject) {
        toast.error("Subject is required");
        return;
      }

      const payload = {
        ...questionForm,
        options: questionForm.options.filter(o => o.text),
      };

      if (editingQuestionId) {
        await api.put(`/questions/${editingQuestionId}`, payload);
        toast.success("Question updated");
      } else {
        await api.post("/questions", payload);
        toast.success("Question created");
      }
      
     await load();

if (closeAfterSave) {

    setOpenQuestion(false);
    setEditingQuestionId(null);
    setQuestionForm(blankQuestion());
    setImagePreview(null);

} else {

    toast.success("Question saved. Ready for next question.");

    setEditingQuestionId(null);

    setQuestionForm({
        ...blankQuestion(),

        subject: questionForm.subject,
        chapter: questionForm.chapter,
        topic: questionForm.topic,
        test_folder: questionForm.test_folder,

        difficulty: questionForm.difficulty,

        marking_pattern: questionForm.marking_pattern,

        default_marks: questionForm.default_marks,
        default_negative_marks:
            questionForm.default_negative_marks
    });

    setImagePreview(null);

      setTimeout(() => {
        titleRef.current?.focus();
    }, 100);
}
    } catch (e) {
      console.error("Submit error", e);
      toast.error(e?.response?.data?.detail || "Failed to save question");
    }
  };

  const deleteQuestion = async (id) => {
    if (!window.confirm("Delete this question?")) return;
    try {
      await api.delete(`/questions/${id}`);
      toast.success("Question deleted");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Delete failed");
    }
  };

  const editQuestion = async (id) => {
    try {
      const { data } = await api.get(`/questions/${id}`);
      setQuestionForm(data);
      setImagePreview(data.image_url);
      setEditingQuestionId(id);
      setOpenQuestion(true);
    } catch (e) {
      toast.error("Failed to load question");
    }
  };

  // ====== FOLDER FUNCTIONS ======
  const openFolderDialog = (folder = null) => {
    if (folder) {
      const selectedIds = folder.question_ids || [];

      setEditingFolderId(folder.folder_name);
      setFolderForm({
        ...blankFolder(),
        folder_name: folder.folder_name || "",
        exam_name: folder.exam_name || folder.folder_name || "",
        description: folder.description || "",
        class_level: folder.class_level || "",
        exam_tag: folder.exam_tag || "",
        exam_id: folder.exam_id || "",
        duration_minutes: folder.duration_minutes || 60,
        passing_marks: folder.passing_marks || 0,
        allowed_tab_switches: folder.allowed_tab_switches || 3,
        instructions: folder.instructions || "Read each question carefully.",
        publish: Boolean(folder.is_published),
        webcam: folder.enable_webcam ?? true,
        randomize: Boolean(folder.randomize),
        tag_questions_to_folder: true,
        selected_question_ids: selectedIds,
        assigned_student_ids: folder.assigned_student_ids || [],
        auto_assign_class: Boolean(folder.auto_assign_class_students),
      });
    } else {
      setEditingFolderId(null);
      setFolderForm(blankFolder());
    }

    setQuestionSearch("");
    setFilterQuestionSubject("all");
    setStudentSearch("");
    setOpenFolder(true);
  };

  const submitFolder = async () => {
    try {
      if (!folderForm.folder_name.trim()) {
        toast.error("Folder name is required");
        return;
      }
      if (!folderForm.exam_name.trim()) {
        toast.error("Exam name is required");
        return;
      }
      if (folderForm.selected_question_ids.length === 0) {
        toast.info("No questions selected yet — the folder will still be created and you can add questions later.");
      }

      const trimmedName = folderForm.folder_name.trim();
      const payload = {
        exam_id: folderForm.exam_id || undefined,
        folder_name: trimmedName,
        exam_name: folderForm.exam_name.trim(),
        description: folderForm.description,
        class_level: folderForm.class_level,
        exam_tag: folderForm.exam_tag,
        duration_minutes: folderForm.duration_minutes,
        passing_marks: folderForm.passing_marks,
        allowed_tab_switches: folderForm.allowed_tab_switches,
        instructions: folderForm.instructions,
        is_published: folderForm.publish,
        enable_webcam: folderForm.webcam,
        randomize: folderForm.randomize,
        tag_questions_to_folder: folderForm.tag_questions_to_folder,
        question_ids: folderForm.selected_question_ids,
        assigned_student_ids: folderForm.assigned_student_ids,
        auto_assign_class_students: folderForm.auto_assign_class,
      };

      const previousFolder = editingFolderId
        ? folders.find((item) => item.folder_name === editingFolderId)
        : null;
      const previousIds = previousFolder?.question_ids || [];

      // Build exam payload for API
      const examPayload = {
        name: folderForm.exam_name.trim(),
        description: folderForm.description,
        type: "mock",
        exam_type: "mock",
        class_level: folderForm.class_level,
        exam_tag: folderForm.exam_tag,
        duration_minutes: folderForm.duration_minutes,
        passing_marks: folderForm.passing_marks,
        allowed_tab_switches: folderForm.allowed_tab_switches,
        instructions: folderForm.instructions,
        is_published: folderForm.publish,
        enable_webcam: folderForm.webcam,
        randomize: folderForm.randomize,
        question_ids: folderForm.selected_question_ids,
        assigned_student_ids: folderForm.assigned_student_ids,
        total_marks: folderForm.selected_question_ids.length * 4, // Estimate based on default 4 marks per question
      };

      // Create or update exam via API
      let examId = folderForm.exam_id;
      if (editingFolderId && examId) {
        await api.put(`/exams/${examId}`, examPayload);
      } else {
        const { data } = await api.post("/exams", examPayload);
        examId = data.id;
      }

      const createdFolder = {
        folder_name: trimmedName,
        exam_name: folderForm.exam_name.trim(),
        description: folderForm.description,
        class_level: folderForm.class_level,
        exam_tag: folderForm.exam_tag,
        exam_id: examId || "",
        duration_minutes: folderForm.duration_minutes,
        passing_marks: folderForm.passing_marks,
        allowed_tab_switches: folderForm.allowed_tab_switches,
        instructions: folderForm.instructions,
        is_published: folderForm.publish,
        enable_webcam: folderForm.webcam,
        randomize: folderForm.randomize,
        question_ids: folderForm.selected_question_ids,
        question_count: folderForm.selected_question_ids.length,
      };

      setFolders((prev) => {
        if (editingFolderId) {
          return prev.map((item) => item.folder_name === editingFolderId ? createdFolder : item);
        }
        return [createdFolder, ...prev.filter((item) => item.folder_name !== trimmedName)];
      });

      syncFolderQuestionAssignments(trimmedName, folderForm.selected_question_ids, previousIds);
      toast.success(editingFolderId ? "Section card updated!" : "Section card created!");
      
      setOpenFolder(false);
      setEditingFolderId(null);
      setActiveFolder(null);
      setFolderForm(blankFolder());
    } catch (e) {
      console.error("Submit error", e);
      toast.error(e?.response?.data?.detail || "Failed to create exam folder");
    }
  };

  const deleteFolder = async (folderName) => {
    if (!window.confirm(`Delete section card "${folderName}"?`)) return;
    try {
      const folderToDelete = folders.find((item) => item.folder_name === folderName);
      const folderQuestionIds = folderToDelete?.question_ids || [];
      
      // Delete exam from API if it has an exam_id
      if (folderToDelete?.exam_id) {
        await api.delete(`/exams/${folderToDelete.exam_id}`);
      }
      
      setFolders((prev) => prev.filter((item) => item.folder_name !== folderName));
      setAllQuestions((prev) =>
        prev.map((question) =>
          folderQuestionIds.includes(question.id) ? { ...question, test_folder: "" } : question
        )
      );
      toast.success("Section card deleted");
    } catch (e) {
      toast.error("Delete failed");
    }
  };

  // Filtered questions for the dialog
  const dialogQuestions = allQuestions.filter((q) => {
    const matchesSubject = filterQuestionSubject === "all" || q.subject === filterQuestionSubject;
    const matchesSearch =
      !questionSearch ||
      q.title.toLowerCase().includes(questionSearch.toLowerCase()) ||
      q.description?.toLowerCase().includes(questionSearch.toLowerCase()) ||
      (q.tags || []).some((t) => t.toLowerCase().includes(questionSearch.toLowerCase()));
    return matchesSubject && matchesSearch;
  });

  // Filtered students for the dialog
  const dialogStudents = allStudents.filter((s) => {
    const m = studentSearch.toLowerCase();
    const classMatch = !folderForm.class_level || s.class_level === folderForm.class_level;
    return (
      classMatch &&
      (!m ||
        s.name?.toLowerCase().includes(m) ||
        s.username?.toLowerCase().includes(m) ||
        s.enrollment_no?.toLowerCase().includes(m))
    );
  });

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="overline">// Question Bank</div>
          <h1 className="heading text-3xl font-bold mt-1">Exam Folders</h1>
          <p className="text-sm text-muted-foreground mt-1">{folders.length} folders · {allQuestions.length} total questions</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setOpenQuestion(true)} className="mr-2">
            <Plus className="w-4 h-4 mr-1" /> Create Question
          </Button>
                  <Button onClick={() => openFolderDialog()}>
            <FolderPlus className="w-4 h-4 mr-1" /> Create Section Card
          </Button>
    
        </div>
      </header>

      {/* ADD QUESTION DIALOG */}
      <Dialog open={openQuestion} onOpenChange={(o) => {
        setOpenQuestion(o);
        if (!o) {
          setEditingQuestionId(null);
          setQuestionForm(blankQuestion());
          setImagePreview(null);
        }
      }}>
        <DialogContent className="rounded-sm max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
           <DialogTitle>

    {editingQuestionId
        ? "Edit Question"
        : "New Question"}

    {!editingQuestionId && (
        <div className="text-sm text-muted-foreground mt-1">
            Questions Added : {questionCount}
        </div>
    )}

</DialogTitle>
          </DialogHeader>

          <Tabs
    value={activeTab}
    onValueChange={setActiveTab}
>
            <TabsList>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="options">Options</TabsTrigger>
              <TabsTrigger value="metadata">Metadata</TabsTrigger>
            </TabsList>

            {/* Content Tab */}
            <TabsContent value="content" className="space-y-3">
              <div>
                <Label>Question Title *</Label>
                <Textarea  ref={titleRef} rows={2} value={questionForm.title} onChange={(e) => setQuestionForm({ ...questionForm, title: e.target.value })} placeholder="What is 2 + 2?" />
              </div>

           

              <div>
                <Label>Question Image (optional)</Label>
                <div 
                  onDragOver={(e) => e.preventDefault()} 
                  onDrop={handleImageDrop}
                  className="border-2 border-dashed border-border rounded-sm p-4 text-center cursor-pointer hover:bg-muted/50"
                >
                  <div className="space-y-2">
                    <ImageIcon className="w-8 h-8 mx-auto text-muted-foreground" />
                    <div className="text-sm text-muted-foreground">
                      Drag & drop image, or <button type="button" className="text-primary font-medium" onClick={() => fileInputRef.current?.click()}>browse</button>
                    </div>
                  </div>
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => uploadImage(e.target.files?.[0])}
                      className="hidden"
                      disabled={uploading}
                    />
                  </div>
                  {uploading && <div className="text-sm text-muted-foreground animate-pulse">Uploading...</div>}
                  {imagePreview && (
                    <div className="mt-2 relative w-full max-w-sm">
                      <img src={imagePreview} alt="Preview" className="w-full rounded-sm border border-border" />
                      <button 
                        type="button"
                        onClick={() => { setQuestionForm({ ...questionForm, image_url: "" }); setImagePreview(null); }}
                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-sm"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Options Tab */}
              <TabsContent value="options" className="space-y-3">
                <div>
                  <Label>Question Type *</Label>
                  <Select value={questionForm.type} onValueChange={(v) => setQuestionForm({ ...questionForm, type: v })}>
                    <SelectTrigger className="rounded-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUESTION_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {["mcq_single", "mcq_multi", "true_false"].includes(questionForm.type) && (
                  <div>
                    <Label>Options</Label>
                    <div className="space-y-2">
                      {(questionForm.options || []).map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input 
                            placeholder={`Option ${idx + 1}`} 
                            value={opt.text} 
                            onChange={(e) => {
                              const newOpts = [...questionForm.options];
                              newOpts[idx].text = e.target.value;
                              setQuestionForm({ ...questionForm, options: newOpts });
                            }}
                            className="rounded-sm"
                          />
                          <Select value={opt.key} onValueChange={(v) => {
                            const newOpts = [...questionForm.options];
                            newOpts[idx].key = v;
                            setQuestionForm({ ...questionForm, options: newOpts });
                          }}>
                            <SelectTrigger className="rounded-sm w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {["A", "B", "C", "D", "E"].map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => setQuestionForm({ ...questionForm, options: questionForm.options.filter((_, i) => i !== idx) })}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setQuestionForm({ ...questionForm, options: [...(questionForm.options || []), { key: "A", text: "" }] })}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add Option
                      </Button>
                    </div>
                  </div>
                )}

                <div>
                  <Label>Correct Answer</Label>
                  <Input 
                    value={questionForm.correct_answer || ""} 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (questionForm.type === "mcq_multi") {
                        setQuestionForm({ ...questionForm, correct_answer: val.split(",").map(s => s.trim()).filter(Boolean) });
                      } else {
                        setQuestionForm({ ...questionForm, correct_answer: val });
                      }
                    }}
                    placeholder={questionForm.type === "mcq_multi" ? "A,C" : "A or answer"}
                    className="rounded-sm mono"
                  />
                </div>
              </TabsContent>

              {/* Metadata Tab */}
              <TabsContent value="metadata" className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Subject *</Label>
                    <div className="flex items-center h-10 px-3 bg-muted rounded-sm border border-input">
                      <span className="font-medium">Mathematics</span>
                    </div>
                  </div>

                  <div>
                    <Label>Difficulty</Label>
                    <Select value={questionForm.difficulty} onValueChange={(v) => setQuestionForm({ ...questionForm, difficulty: v })}>
                      <SelectTrigger className="rounded-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DIFFICULTIES.map((d) => <SelectItem key={d.v} value={d.v}>{d.l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Chapter (optional)</Label>
                    <Input 
                      value={questionForm.chapter} 
                      onChange={(e) => setQuestionForm({ ...questionForm, chapter: e.target.value })}
                      placeholder="e.g. Quadratic Equations"
                      className="rounded-sm"
                    />
                  </div>

                  <div>
                    <Label>Folder (optional)</Label>
                    <Select value={questionForm.test_folder} onValueChange={(v) => setQuestionForm({ ...questionForm, test_folder: v })}>
                      <SelectTrigger className="rounded-sm">
                        <SelectValue placeholder="Assign to folder" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No folder</SelectItem>
                        {folders.map((f) => (
                          <SelectItem key={f.folder_name} value={f.folder_name}>{f.folder_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

               

                <div className="space-y-3">
                  <Label>Marking Pattern</Label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={questionForm.marking_pattern === "positive_only" ? "default" : "outline"}
                      onClick={() => setQuestionForm({ ...questionForm, marking_pattern: "positive_only" })}
                      className="rounded-sm"
                    >
                      Positive only (+marks)
                    </Button>
                    <Button
                      size="sm"
                      variant={questionForm.marking_pattern === "custom" ? "default" : "outline"}
                      onClick={() => setQuestionForm({ ...questionForm, marking_pattern: "custom" })}
                      className="rounded-sm"
                    >
                      Custom (+/-)
                    </Button>
                    <Button
                      size="sm"
                      variant={questionForm.marking_pattern === "no_negative" ? "default" : "outline"}
                      onClick={() => setQuestionForm({ ...questionForm, marking_pattern: "no_negative" })}
                      className="rounded-sm"
                    >
                      No negative
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Default +marks</Label>
                      <Input 
                        type="number" 
                        value={questionForm.default_marks} 
                        onChange={(e) => setQuestionForm({ ...questionForm, default_marks: Number(e.target.value) })}
                        className="rounded-sm mono"
                      />
                    </div>

                    {questionForm.marking_pattern !== "no_negative" && (
                      <div>
                        <Label>Default -marks</Label>
                        <Input 
                          type="number" 
                          value={questionForm.default_negative_marks} 
                          onChange={(e) => setQuestionForm({ ...questionForm, default_negative_marks: Number(e.target.value) })}
                          className="rounded-sm mono"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

         <DialogFooter className="gap-2">

    <Button
        variant="outline"
        onClick={() => setOpenQuestion(false)}
    >
        Cancel
    </Button>

    <Button
        variant="secondary"
        onClick={() => submitQuestion(false)}
    >
        Save & Next
    </Button>

    <Button
        onClick={() => submitQuestion(true)}
    >
        Save & Close
    </Button>

</DialogFooter>
          </DialogContent>
        </Dialog>

      {/* CREATE EXAM FOLDER DIALOG */}
      <Dialog
        open={openFolder}
        onOpenChange={(o) => {
          setOpenFolder(o);
          if (!o) {
            setEditingFolderId(null);
            setFolderForm(blankFolder());
            setQuestionSearch("");
            setFilterQuestionSubject("all");
            setStudentSearch("");
          }
        }}
      >
        <DialogContent className="rounded-sm max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFolderId ? "Edit Section Card" : "Create Section Card"}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="folder-info">
            <TabsList>
              <TabsTrigger value="folder-info">Folder Info</TabsTrigger>
              <TabsTrigger value="questions">Questions ({folderForm.selected_question_ids.length})</TabsTrigger>
              <TabsTrigger value="students">Students ({folderForm.assigned_student_ids.length})</TabsTrigger>
            </TabsList>

            {/* Folder Info Tab */}
            <TabsContent value="folder-info" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Folder Name *</Label>
                  <Input
                    value={folderForm.folder_name}
                    onChange={(e) => setFolderForm({ ...folderForm, folder_name: e.target.value })}
                    placeholder="e.g. JEE Mains 2024 Paper 1"
                    className="rounded-sm"
                    data-testid="folder-name"
                  />
                </div>
                <div>
                  <Label>Exam Name *</Label>
                  <Input
                    value={folderForm.exam_name}
                    onChange={(e) => setFolderForm({ ...folderForm, exam_name: e.target.value })}
                    placeholder="e.g. JEE Mains Mock — 12th"
                    className="rounded-sm"
                    data-testid="exam-name"
                  />
                </div>
              </div>

              <div>
                <Label>Description (optional)</Label>
                <Textarea
                  rows={2}
                  value={folderForm.description}
                  onChange={(e) => setFolderForm({ ...folderForm, description: e.target.value })}
                  placeholder="Exam description..."
                  className="rounded-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Class / Section</Label>
                  <Select value={folderForm.class_level} onValueChange={(v) => setFolderForm({ ...folderForm, class_level: v })}>
                    <SelectTrigger className="rounded-sm">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any (Both 11th & 12th)</SelectItem>
                      <SelectItem value="11th">11th Standard</SelectItem>
                      <SelectItem value="12th">12th Standard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Exam Tag</Label>
                  <Select value={folderForm.exam_tag} onValueChange={(v) => setFolderForm({ ...folderForm, exam_tag: v })}>
                    <SelectTrigger className="rounded-sm">
                      <SelectValue placeholder="Select tag" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXAM_TAGS.map((tag) => (
                        <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Duration (min)</Label>
                  <Input
                    type="number"
                    value={folderForm.duration_minutes}
                    onChange={(e) => setFolderForm({ ...folderForm, duration_minutes: Number(e.target.value) })}
                    className="rounded-sm mono"
                  />
                </div>
                <div>
                  <Label>Passing Marks</Label>
                  <Input
                    type="number"
                    value={folderForm.passing_marks}
                    onChange={(e) => setFolderForm({ ...folderForm, passing_marks: Number(e.target.value) })}
                    className="rounded-sm mono"
                  />
                </div>
                <div>
                  <Label>Allowed Tab Switches</Label>
                  <Input
                    type="number"
                    value={folderForm.allowed_tab_switches}
                    onChange={(e) => setFolderForm({ ...folderForm, allowed_tab_switches: Number(e.target.value) })}
                    className="rounded-sm mono"
                  />
                </div>
              </div>

              <div>
                <Label>Instructions</Label>
                <Textarea
                  rows={3}
                  value={folderForm.instructions}
                  onChange={(e) => setFolderForm({ ...folderForm, instructions: e.target.value })}
                  placeholder="Exam instructions..."
                  className="rounded-sm"
                />
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Publish Exam</div>
                  <Switch
                    checked={folderForm.publish}
                    onCheckedChange={(v) => setFolderForm({ ...folderForm, publish: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Webcam Proctoring</div>
                  <Switch
                    checked={folderForm.webcam}
                    onCheckedChange={(v) => setFolderForm({ ...folderForm, webcam: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Randomize Questions</div>
                  <Switch
                    checked={folderForm.randomize}
                    onCheckedChange={(v) => setFolderForm({ ...folderForm, randomize: v })}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Questions Tab */}
            <TabsContent value="questions" className="space-y-3">
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  Empty folders are allowed. You can create a category first and add existing questions later.
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Search question text / tags"
                      value={questionSearch}
                      onChange={(e) => setQuestionSearch(e.target.value)}
                      className="rounded-sm h-9"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setFolderForm({
                        ...folderForm,
                        selected_question_ids: dialogQuestions.map((q) => q.id),
                      });
                    }}
                  >
                    Select all visible
                  </Button>
                </div>

                <div className="max-h-[400px] overflow-y-auto border border-border rounded-sm">
                    {dialogQuestions.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        No questions found
                      </div>
                    ) : (
                      <>
                        {dialogQuestions.map((q) => (
                          <label
                            key={q.id}
                            className="flex gap-3 items-start p-3 border-b border-border last:border-0 hover:bg-muted/40 cursor-pointer"
                          >
                            <Checkbox
                              checked={folderForm.selected_question_ids.includes(q.id)}
                              onCheckedChange={(c) => {
                                if (c) {
                                  setFolderForm({
                                    ...folderForm,
                                    selected_question_ids: [...folderForm.selected_question_ids, q.id],
                                  });
                                } else {
                                  setFolderForm({
                                    ...folderForm,
                                    selected_question_ids: folderForm.selected_question_ids.filter(
                                      (id) => id !== q.id
                                    ),
                                  });
                                }
                              }}
                              data-testid={`q-check-${q.id}`}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium line-clamp-2">{q.title}</div>
                              <div className="flex flex-wrap gap-2 mt-1.5">
                                <Badge variant="outline" className="text-[10px] rounded-sm">
                                  {q.subject}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] rounded-sm ${
                                    q.difficulty === "easy"
                                      ? "bg-green-100 text-green-800"
                                      : q.difficulty === "medium"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {q.difficulty}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground mono">
                                  {q.chapter && `${q.chapter} `}
                                  +{q.default_marks || q.marks}/{-(q.default_negative_marks || q.negative_marks || 0)}
                                </span>
                              </div>
                            </div>
                          </label>
                        ))}
                      </>
                    )}
                  </div>

                  <label className="flex items-start gap-2 p-3 border border-border rounded-sm cursor-pointer">
                    <Checkbox
                      checked={folderForm.tag_questions_to_folder}
                      onCheckedChange={(c) => setFolderForm({ ...folderForm, tag_questions_to_folder: c })}
                    />
                    <div className="text-xs text-muted-foreground">
                      Also tag selected questions with this folder name (🏷 badge will appear on each)
                    </div>
                  </label>
                </div>
              </TabsContent>

              {/* Students Tab */}
              <TabsContent value="students" className="space-y-3">
                <div className="flex items-center justify-between p-3 border border-border rounded-sm bg-muted/30">
                  <div>
                    <div className="text-sm font-medium">Auto-assign to all active {folderForm.class_level || "all"} students</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Every active student will get this exam. You can also tick additional students below.
                    </div>
                  </div>
                  <Switch
                    checked={folderForm.auto_assign_class}
                    onCheckedChange={(v) => setFolderForm({ ...folderForm, auto_assign_class: v })}
                  />
                </div>

                <div>
                  <Input
                    placeholder="Search name / username / enrollment"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="rounded-sm h-9"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setFolderForm({
                        ...folderForm,
                        assigned_student_ids: dialogStudents.map((s) => s.id),
                      });
                    }}
                  >
                    Select all visible
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setFolderForm({ ...folderForm, assigned_student_ids: [] })}
                  >
                    Clear
                  </Button>
                </div>

                <div className="max-h-[350px] overflow-y-auto border border-border rounded-sm">
                  {dialogStudents.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      No students found
                    </div>
                  ) : (
                    <>
                      {dialogStudents.map((s) => (
                        <label
                          key={s.id}
                          className="flex gap-3 items-start p-3 border-b border-border last:border-0 hover:bg-muted/40 cursor-pointer"
                        >
                          <Checkbox
                            checked={folderForm.assigned_student_ids.includes(s.id)}
                            onCheckedChange={(c) => {
                              if (c) {
                                setFolderForm({
                                  ...folderForm,
                                  assigned_student_ids: [...folderForm.assigned_student_ids, s.id],
                                });
                              } else {
                                setFolderForm({
                                  ...folderForm,
                                  assigned_student_ids: folderForm.assigned_student_ids.filter(
                                    (id) => id !== s.id
                                  ),
                                });
                              }
                            }}
                            data-testid={`s-check-${s.id}`}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">
                              {s.name} <span className="text-xs text-muted-foreground mono">@{s.username}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mono mt-1">
                              {s.class_level && <Badge variant="outline" className="rounded-sm text-[10px] mr-1">{s.class_level}</Badge>}
                              {s.enrollment_no || "—"} · {s.email || "no email"}
                            </div>
                          </div>
                        </label>
                      ))}
                    </>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenFolder(false)}>Cancel</Button>
              <Button onClick={submitFolder} data-testid="create-folder-btn-submit">
                <FolderPlus className="w-4 h-4 mr-1" /> {editingFolderId ? "Save Section Card" : "Create Section Card"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Folder sections */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-semibold">Exam Folders</h2>
            <p className="text-sm text-muted-foreground mt-1">Open a section card to add existing questions into that folder.</p>
          </div>
  
        </div>

        {activeFolder ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border bg-muted/40 p-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Active section</div>
                <h3 className="text-lg font-semibold">{activeFolder}</h3>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setActiveFolder(null)}>Back to sections</Button>
              </div>
            </div>

            <div className="grid-card p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">Assigned questions</div>
                  <div className="text-sm text-muted-foreground">Questions currently inside this section.</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setFolderQuestionSelection((prev) => ({ ...prev, [activeFolder]: [] }))}>
                  Clear selection
                </Button>
              </div>

              <div className="rounded-sm border border-border overflow-hidden">
                {currentFolderQuestions.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">No questions assigned to this section yet</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted border-b border-border">
                        <tr>
                          <th className="text-left p-3 font-medium">Title</th>
                          <th className="text-left p-3 font-medium">Type</th>
                          <th className="text-right p-3 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentFolderQuestions.map((q) => (
                          <tr key={q.id} className="border-b border-border hover:bg-muted/50">
                            <td className="p-3 font-medium">{q.title}</td>
                            <td className="p-3"><Badge variant="outline" className="text-xs">{q.type}</Badge></td>
                            <td className="p-3 text-right">
                              <Button size="sm" variant="ghost" onClick={() => removeQuestionFromFolder(activeFolder, q.id)}>
                                Move to unassigned
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="grid-card p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">Unassigned questions</div>
                  <div className="text-sm text-muted-foreground">Pick questions from here and add them to this section.</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setFolderQuestionSelection((prev) => ({ ...prev, [activeFolder]: [] }))}>
                  Clear selection
                </Button>
              </div>

              <div className="max-h-[320px] overflow-y-auto rounded-sm border border-border">
                {unassignedQuestionsForFolder.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">No unassigned questions available</div>
                ) : (
                  unassignedQuestionsForFolder.map((question) => (
                    <label key={question.id} className="flex gap-3 items-start border-b border-border p-3 last:border-0 hover:bg-muted/40 cursor-pointer">
                      <Checkbox
                        checked={selectedFolderQuestionIds.includes(question.id)}
                        onCheckedChange={() => toggleFolderQuestionSelection(activeFolder, question.id)}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium line-clamp-2">{question.title}</div>
                        <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                          <Badge variant="outline" className="rounded-sm">{question.subject}</Badge>
                          <Badge variant="outline" className="rounded-sm">{question.type}</Badge>
                          <span>+{question.default_marks || question.marks} / -{question.default_negative_marks || question.negative_marks || 0}</span>
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>

              <div className="flex justify-end">
                <Button onClick={() => addQuestionsToFolder(activeFolder)}>Add selected questions</Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {folderCards.length === 0 ? (
              <div className="grid-card p-12 text-center text-muted-foreground md:col-span-3">
                No section cards yet. Create your first card!
              </div>
            ) : (
              folderCards.map((folder) => {
                const folderQuestionIds = Array.isArray(folder.question_ids) ? folder.question_ids : [];
                const folderQuestions = allQuestions.filter((q) =>
                  folderQuestionIds.includes(q.id) || q.test_folder === folder.folder_name
                );
                const isDefaultSection = DEFAULT_FOLDER_SECTIONS.some((section) => section.folder_name === folder.folder_name);
                return (
                  <div key={folder.folder_name} className="grid-card border border-border rounded-sm p-5 space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="heading text-lg font-semibold">{folder.folder_name}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">{folder.description || "Question section for focused practice"}</p>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{folderQuestions.length} questions</span>
                      <Badge variant="outline" className="rounded-sm text-xs">{folder.exam_tag || "Section"}</Badge>
                    </div>

                    <div className="flex gap-2">
                      <Button className="flex-1" size="sm" onClick={() => setActiveFolder(folder.folder_name)}>
                        Open section
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openFolderDialog(folder)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteFolder(folder.folder_name)} className="text-red-600 hover:text-red-700">
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>

      {/* Questions without folder */}
      {allQuestions.some(q => !q.test_folder) && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Unassigned Questions ({allQuestions.filter(q => !q.test_folder).length})</h2>
          <div className="rounded-sm border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="text-left p-3 font-medium">Title</th>
                  <th className="text-left p-3 font-medium">Subject</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Difficulty</th>
                  <th className="text-left p-3 font-medium">Marks</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allQuestions.filter(q => !q.test_folder).map((q) => (
                  <tr key={q.id} className="border-b border-border hover:bg-muted/50">
                    <td className="p-3">
                      <div className="font-medium line-clamp-1">{q.title}</div>
                    </td>
                    <td className="p-3 text-sm">{q.subject}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">{q.type}</Badge>
                    </td>
                    <td className="p-3">
                      <Badge className={DIFFICULTIES.find(d => d.v === q.difficulty)?.color}>
                        {DIFFICULTIES.find(d => d.v === q.difficulty)?.l}
                      </Badge>
                    </td>
                    <td className="p-3 mono text-sm font-medium">
                      +{q.default_marks || q.marks} / -{q.default_negative_marks || q.negative_marks || 0}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => editQuestion(q.id)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteQuestion(q.id)} className="text-red-600 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
