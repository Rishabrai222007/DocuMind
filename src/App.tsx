/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Upload, 
  FileText, 
  Send, 
  MessageCircle, 
  Sparkles, 
  BrainCircuit, 
  X,
  Loader2,
  ChevronRight,
  HelpCircle,
  FileSearch,
  Image as ImageIcon,
  CheckCircle2,
  Languages,
  MessageSquareQuote,
  ClipboardCheck,
  Copy,
  Zap,
  Linkedin,
  ExternalLink,
  BookOpen,
  Printer,
  Download
} from "lucide-react";
import Markdown from "react-markdown";
import { cn } from "@/src/lib/utils";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const LANGUAGES = ["English", "Spanish", "French", "German", "Chinese", "Hindi", "Japanese"];
const TONES = ["Professional", "Simple/ELI5", "Concise", "Bullet Points", "Critical Analysis"];

export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("English");
  const [selectedTone, setSelectedTone] = useState("Professional");
  const [copied, setCopied] = useState(false);
  const [isExtractingAction, setIsExtractingAction] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isProcessing]);

  const validateFiles = (newFiles: File[]) => {
    const totalSize = [...files, ...newFiles].reduce((acc, f) => acc + f.size, 0);
    const totalCount = files.length + newFiles.length;

    if (totalCount > 10) {
      setError("Maximum 10 files allowed.");
      return false;
    }
    if (totalSize > 100 * 1024 * 1024) {
      setError("Total size exceeds 100MB.");
      return false;
    }

    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const invalidFiles = newFiles.filter(f => !validTypes.includes(f.type));
    if (invalidFiles.length > 0) {
      setError("Only PDF, JPEG, PNG, and WebP files are supported.");
      return false;
    }

    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      if (validateFiles(selectedFiles)) {
        setFiles(prev => [...prev, ...selectedFiles]);
        setError(null);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (validateFiles(droppedFiles)) {
        setFiles(prev => [...prev, ...droppedFiles]);
        setError(null);
      }
    }
  };

  const processFile = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setSummary(null);
    setChatMessages([]);

    const formData = new FormData();
    files.forEach(f => formData.append("files", f));
    formData.append("language", selectedLanguage);
    formData.append("tone", selectedTone);

    try {
      const response = await fetch("/api/process-document", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to process files");

      setSummary(data.result);
      setChatMessages([
        { role: 'assistant', content: "Documents analyzed! You can now ask me any questions about their combined content." }
      ]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const synthesizeBook = async () => {
    if (files.length === 0 || isSynthesizing) return;
    setIsSynthesizing(true);
    setError(null);

    const formData = new FormData();
    files.forEach(f => formData.append("files", f));
    formData.append("language", selectedLanguage);

    try {
      const response = await fetch("/api/synthesize-book", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Synthesis failed");

      setSummary(data.result);
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: "# 📚 Book Synthesis Complete\nI have unified the knowledge from all documents into a cohesive digital book structure. You can read it in the analysis panel on the left." }
      ]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const extractActionItems = async () => {
    if (files.length === 0 || isExtractingAction) return;
    setIsExtractingAction(true);
    
    const formData = new FormData();
    files.forEach(f => formData.append("files", f));

    try {
      const response = await fetch("/api/extract-actions", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      setChatMessages(prev => [...prev, { role: 'assistant', content: `### 📋 Action Items Extracted\n\n${data.result}` }]);
    } catch (err: any) {
      setError("Failed to extract actions");
    } finally {
      setIsExtractingAction(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || files.length === 0 || isProcessing) return;

    const question = inputValue.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: question }]);
    setInputValue("");
    setIsProcessing(true);

    const formData = new FormData();
    files.forEach(f => formData.append("files", f));
    formData.append("question", question);
    formData.append("language", selectedLanguage);
    formData.append("tone", selectedTone);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to get response");

      setChatMessages(prev => [...prev, { role: 'assistant', content: data.result }]);
    } catch (err: any) {
      setError(err.message);
      setChatMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setFiles([]);
    setSummary(null);
    setChatMessages([]);
    setError(null);
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const getFileIcon = (fileItem?: File) => {
    const f = fileItem || (files.length > 0 ? files[0] : null);
    if (!f) return <Upload size={32} />;
    if (f.type === "application/pdf") return <FileText size={32} className="text-red-500" />;
    if (f.type.startsWith("image/")) return <ImageIcon size={32} className="text-blue-500" />;
    return <FileText size={32} />;
  };

  const printSummary = () => {
    window.print();
  };

  const downloadAsText = () => {
    if (!summary) return;
    const blob = new Blob([summary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DocuMind_Analysis_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-[100dvh] bg-[#FDFCFB] text-[#1D1D1F] font-sans selection:bg-orange-100 selection:text-orange-900 border-t-4 border-orange-600">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3" id="logo">
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-200 active:rotate-12 transition-transform cursor-pointer">
              <BrainCircuit size={24} />
            </div>
            <div className="flex flex-col -space-y-0.5 sm:-space-y-1">
              <span className="font-extrabold text-xl sm:text-2xl tracking-tighter font-display">DocuMind</span>
              <span className="text-[9px] sm:text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] opacity-80 leading-none sm:block">By Rishab Rai</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <a 
              href="https://www.linkedin.com/in/rishabrai69/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group hidden md:flex items-center gap-2 text-xs font-black text-gray-500 hover:text-orange-600 transition-all px-4 py-2 rounded-full hover:bg-orange-50 border border-transparent hover:border-orange-100"
              id="linkedin-link"
            >
              <Linkedin size={16} className="text-gray-400 group-hover:text-orange-600 transition-colors" />
              <span>CONNECT</span>
            </a>
            
            {files.length > 0 && (
              <button 
                onClick={reset}
                className="text-xs sm:text-sm font-black text-gray-900 transition-all flex items-center gap-2 bg-gray-50 px-4 py-2.5 sm:px-5 sm:py-3 rounded-full border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-100 active:scale-95 shadow-sm"
                id="reset-btn"
              >
                <X size={16} strokeWidth={3} />
                <span className="hidden sm:inline uppercase tracking-wider">New Analysis</span>
                <span className="sm:hidden uppercase tracking-wider text-[10px]">New</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
        {!summary ? (
          <div className="max-w-3xl mx-auto space-y-8 sm:space-y-12 pb-20">
            <div className="text-center space-y-6 sm:space-y-8 py-4 sm:py-0">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-2 bg-orange-100/50 text-orange-700 px-5 py-2 rounded-full text-[10px] sm:text-xs font-black tracking-[0.15em] border border-orange-200/50 shadow-sm uppercase"
              >
                <Sparkles size={14} className="animate-pulse" />
                AI-Powered Intelligence
              </motion.div>
              
              <div className="space-y-3 sm:space-y-4">
                <motion.h1 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-4xl sm:text-7xl font-black tracking-tight text-gray-900 leading-[1.1] font-display"
                  id="hero-title"
                >
                  Understand any <br className="hidden sm:block" />
                  document in <span className="text-orange-600 relative inline-block">
                    seconds
                    <svg className="absolute -bottom-2 left-0 w-full h-2 text-orange-200/60" viewBox="0 0 100 10" preserveAspectRatio="none">
                      <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="transparent" strokeLinecap="round" />
                    </svg>
                  </span>
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-base sm:text-xl text-gray-500 font-medium max-w-xl mx-auto leading-relaxed px-4"
                  id="hero-subtitle"
                >
                  Upload documents to get instant summaries, key insights, and interact with your content effortlessly.
                </motion.p>
              </div>
            </div>

            {/* Config Panel */}
            <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.15 }}
               className="bg-white border border-gray-100 rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 shadow-2xl shadow-gray-200/50 grid md:grid-cols-2 gap-8 relative overflow-hidden"
            >
               <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50/50 -mr-16 -mt-16 rounded-full blur-3xl"></div>
               
               <div className="space-y-5 relative z-10">
                  <label className="text-[10px] sm:text-xs font-black text-gray-400 flex items-center gap-2 tracking-[0.2em] uppercase">
                    <Languages size={14} className="text-orange-500" /> Target Language
                  </label>
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    {LANGUAGES.slice(0, 4).map(lang => (
                      <button 
                        key={lang}
                        onClick={() => setSelectedLanguage(lang)}
                        className={cn(
                          "px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all border outline-none active:scale-95",
                          selectedLanguage === lang 
                            ? "bg-orange-600 text-white border-orange-600 shadow-xl shadow-orange-200" 
                            : "bg-gray-50 text-gray-600 border-transparent hover:border-orange-200 hover:bg-white"
                        )}
                      >
                        {lang}
                      </button>
                    ))}
                    <select 
                      value={LANGUAGES.includes(selectedLanguage) ? selectedLanguage : selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                      className="px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold bg-gray-50 text-gray-600 border border-transparent hover:border-orange-200 hover:bg-white outline-none cursor-pointer transition-all active:scale-95"
                    >
                      {!LANGUAGES.slice(0,4).includes(selectedLanguage) && <option value={selectedLanguage}>{selectedLanguage}</option>}
                      {LANGUAGES.slice(4).map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
               </div>
               <div className="space-y-5 relative z-10">
                  <label className="text-[10px] sm:text-xs font-black text-gray-400 flex items-center gap-2 tracking-[0.2em] uppercase">
                    <MessageSquareQuote size={14} className="text-orange-500" /> Output Tone
                  </label>
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    {TONES.map(tone => (
                      <button 
                        key={tone}
                        onClick={() => setSelectedTone(tone)}
                        className={cn(
                          "px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all border outline-none active:scale-95",
                          selectedTone === tone 
                            ? "bg-orange-600 text-white border-orange-600 shadow-xl shadow-orange-200" 
                            : "bg-gray-50 text-gray-600 border-transparent hover:border-orange-200 hover:bg-white"
                        )}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
               </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className={cn(
                "relative group cursor-pointer transition-all duration-500 ring-4 ring-transparent hover:ring-orange-50 rounded-[2.5rem] sm:rounded-[4rem]",
                isDragging ? "scale-[1.02]" : ""
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              id="drop-zone"
            >
              <input 
                type="file" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,image/png,image/jpeg,image/webp"
                multiple
              />
              
              <div className={cn(
                "border-2 border-dashed rounded-[2.5rem] sm:rounded-[4rem] p-10 sm:p-20 transition-all flex flex-col items-center gap-6 sm:gap-8 text-center shadow-inner overflow-hidden",
                isDragging 
                  ? "border-orange-500 bg-orange-50/80" 
                  : "border-gray-200 bg-white hover:border-orange-300 hover:shadow-2xl hover:shadow-orange-100/20"
              )}>
                <motion.div 
                  layout
                  className={cn(
                    "w-24 h-24 sm:w-32 sm:h-32 rounded-[2rem] sm:rounded-[2.5rem] flex items-center justify-center transition-all duration-500 shadow-2xl relative z-10",
                    isDragging 
                      ? "bg-orange-500 text-white" 
                      : (files.length > 0 ? "bg-white border border-gray-100" : "bg-orange-50 text-orange-600")
                  )}
                >
                  <div className="absolute inset-0 bg-white/20 rounded-[2rem] sm:rounded-[2.5rem] animate-pulse"></div>
                  {getFileIcon()}
                </motion.div>
                
                <div className="space-y-4 relative z-10 w-full max-w-xl">
                  {files.length > 0 ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {files.map((f, i) => (
                           <motion.div 
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-3 bg-gray-50 px-4 py-3 rounded-2xl border border-gray-200 group/file"
                           >
                            <div className="flex-shrink-0">
                              {f.type === "application/pdf" ? <FileText size={18} className="text-red-500" /> : <ImageIcon size={18} className="text-blue-500" />}
                            </div>
                            <span className="font-bold text-gray-900 truncate text-xs flex-1 text-left">
                              {f.name}
                            </span>
                            <button 
                              onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                              className="p-1 hover:bg-red-100 hover:text-red-600 rounded-lg text-gray-400 transition-colors"
                            >
                              <X size={14} strokeWidth={3} />
                            </button>
                           </motion.div>
                        ))}
                      </div>
                      <p className="text-[10px] sm:text-xs text-orange-600 font-black uppercase tracking-[0.2em] bg-orange-50/50 py-2 inline-block px-4 rounded-full">
                        {files.length} FILES • {(files.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(2)} MB TOTAL • READY
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-2xl sm:text-4xl font-black text-gray-900 font-display tracking-tight leading-tight">
                        Drop documents <br className="hidden sm:block" /> to unlock insights
                      </p>
                      <p className="text-gray-500 font-medium text-sm sm:text-lg">
                        Upload up to 10 files (PDF, PNG, JPG, WebP)
                      </p>
                    </>
                  )}
                </div>
              </div>
            </motion.div>

            {files.length > 0 && !isProcessing && !isSynthesizing && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row justify-center gap-4 pt-2"
              >
                <button
                  onClick={processFile}
                  className="bg-gray-950 text-white px-8 py-5 sm:px-12 sm:py-6 rounded-[2rem] font-black text-lg sm:text-xl hover:bg-black transition-all active:scale-95 flex items-center gap-4 shadow-xl group relative overflow-hidden"
                  id="analyze-btn"
                >
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-orange-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
                  <Sparkles size={24} className="text-orange-400 group-hover:rotate-12 transition-transform" />
                  <span className="uppercase tracking-[0.1em]">Analyze All</span>
                </button>

                <button
                  onClick={synthesizeBook}
                  className="bg-white text-gray-950 border-2 border-gray-200 px-8 py-5 sm:px-12 sm:py-6 rounded-[2rem] font-black text-lg sm:text-xl hover:border-orange-500 hover:text-orange-600 transition-all active:scale-95 flex items-center gap-4 shadow-xl group"
                  id="synthesize-btn"
                >
                  <BookOpen size={24} className="text-orange-500 group-hover:scale-110 transition-transform" />
                  <span className="uppercase tracking-[0.1em]">Synthesize Book</span>
                </button>
              </motion.div>
            )}

            {(isProcessing || isSynthesizing) && !summary && (
              <div className="flex flex-col items-center gap-10 py-10">
                <div className="relative group">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 border-8 border-orange-100 border-t-orange-500 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    {isSynthesizing ? <BookOpen size={40} className="text-orange-500 animate-pulse" /> : <BrainCircuit size={40} className="text-orange-500 animate-pulse" />}
                  </div>
                </div>
                <div className="text-center space-y-3">
                  <p className="font-black text-2xl sm:text-4xl text-gray-900 tracking-tight font-display">
                    {isSynthesizing ? "Creating Digital Book..." : "Igniting Insights..."}
                  </p>
                  <p className="text-gray-400 font-bold text-xs sm:text-sm uppercase tracking-[0.25em]">
                    {isSynthesizing ? `Unifying ${files.length} documents into one book` : `Gemini AI is processing your ${files.length} file${files.length > 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-600 p-6 rounded-[2.5rem] border border-red-100 flex items-center gap-5 animate-in slide-in-from-top-4 max-w-xl mx-auto shadow-sm">
                <div className="bg-red-100 p-3 rounded-2xl flex-shrink-0">
                  <X size={28} strokeWidth={3} />
                </div>
                <div>
                  <h4 className="font-black text-xs sm:text-sm uppercase tracking-widest mb-1 leading-none">Analysis Encountered an Issue</h4>
                  <p className="font-bold text-sm sm:text-base opacity-80">{error}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-start h-full">
            {/* Sidebar/Summary */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-5 space-y-6 sm:space-y-10"
            >
              <div className="bg-white rounded-[2.5rem] sm:rounded-[3rem] border border-gray-100 shadow-2xl shadow-gray-200/50 flex flex-col h-full sm:max-h-[calc(100vh-16rem)] min-h-[500px] sm:min-h-0 overflow-hidden">
                <div className="p-6 sm:p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-inner">
                      <FileSearch size={24} />
                    </div>
                    <div className="flex flex-col -space-y-0.5">
                      <h3 className="font-black text-sm sm:text-lg text-gray-900 tracking-tight uppercase tracking-wider font-display">Analysis</h3>
                      <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">{selectedLanguage}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={downloadAsText}
                      className="p-3 sm:p-4 bg-white hover:bg-orange-50 rounded-2xl transition-all text-gray-400 hover:text-orange-600 border border-gray-100 active:scale-95 shadow-sm"
                      title="Download as Text"
                    >
                      <Download size={20} />
                    </button>
                    <button 
                      onClick={printSummary}
                      className="p-3 sm:p-4 bg-white hover:bg-orange-50 rounded-2xl transition-all text-gray-400 hover:text-orange-600 border border-gray-100 active:scale-95 shadow-sm"
                      title="Print / Save as PDF"
                    >
                      <Printer size={20} />
                    </button>
                    <button 
                      onClick={() => copyToClipboard(summary)}
                      className="p-3 sm:p-4 bg-white hover:bg-orange-50 rounded-2xl transition-all text-gray-400 hover:text-orange-600 border border-gray-100 active:scale-95 shadow-sm"
                      title="Copy Summary"
                    >
                      {copied ? <ClipboardCheck size={20} className="text-green-500" /> : <Copy size={20} />}
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 sm:p-10 scrollbar-hide">
                  <div className="markdown-body">
                    <Markdown>{summary}</Markdown>
                  </div>
                </div>

                <div className="p-6 sm:p-8 border-t border-gray-50 bg-gray-50/50 flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={extractActionItems}
                        disabled={isExtractingAction}
                        className="flex items-center justify-center gap-2 bg-white text-gray-950 font-black py-4 px-4 sm:px-6 rounded-2xl border border-gray-200 hover:border-orange-500/30 hover:text-orange-600 transition-all text-xs sm:text-sm shadow-sm active:scale-95 disabled:opacity-50 group uppercase tracking-widest"
                      >
                        {isExtractingAction ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} className="text-orange-500 group-hover:animate-bounce" />}
                        Tasks
                      </button>
                      <button 
                        onClick={reset}
                        className="flex items-center justify-center gap-2 bg-white text-gray-950 font-black py-4 px-4 sm:px-6 rounded-2xl border border-gray-200 hover:border-red-200 hover:text-red-600 transition-all text-xs sm:text-sm shadow-sm active:scale-95 uppercase tracking-widest"
                      >
                        <X size={18} strokeWidth={3} />
                        Reset
                      </button>
                    </div>
                    <button 
                      onClick={synthesizeBook}
                      disabled={isSynthesizing}
                      className="w-full flex items-center justify-center gap-3 bg-gray-950 text-white font-black py-4 px-6 rounded-2xl hover:bg-black transition-all text-xs sm:text-sm shadow-xl active:scale-95 disabled:opacity-50 uppercase tracking-widest"
                    >
                      {isSynthesizing ? <Loader2 size={18} className="animate-spin" /> : <BookOpen size={18} className="text-orange-400" />}
                      Synthesize Digital Book
                    </button>
                </div>
              </div>

              <div className="bg-gray-950 text-white rounded-[2.5rem] p-8 flex gap-6 shadow-2xl shadow-gray-200 relative overflow-hidden group">
                 <div className="absolute inset-0 bg-gradient-to-br from-orange-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                 <div className="w-14 h-14 rounded-2xl bg-orange-600 text-white flex-shrink-0 flex items-center justify-center shadow-xl relative z-10 animate-in zoom-in duration-500">
                    <HelpCircle size={28} />
                 </div>
                 <div className="relative z-10">
                    <h4 className="font-black text-sm sm:text-base uppercase tracking-[0.2em] mb-2 flex items-center gap-2 opacity-90">
                       Neural Engine
                       <div className="flex gap-0.5">
                          {[1,2,3].map(i => <div key={i} className="w-1 h-1 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}></div>)}
                       </div>
                    </h4>
                    <p className="text-xs sm:text-sm text-gray-400 leading-relaxed font-bold">
                       Our vision engine extracted complex layers with {selectedTone} precision. Ask anything below.
                    </p>
                 </div>
              </div>
            </motion.div>

            {/* Chat Area */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-7 flex flex-col h-full min-h-[600px] sm:max-h-[calc(100vh-16rem)] sm:min-h-0"
            >
              <div className="flex-1 bg-white rounded-[2.5rem] sm:rounded-[3rem] border border-gray-100 shadow-2xl shadow-gray-200/40 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 sm:p-12 space-y-10 scrollbar-hide">
                  <AnimatePresence initial={false}>
                    {chatMessages.map((msg, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 15, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className={cn(
                          "flex w-full gap-4 sm:gap-6",
                          msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 sm:w-12 sm:h-12 rounded-[1.25rem] flex-shrink-0 flex items-center justify-center shadow-md border animate-in zoom-in duration-300",
                          msg.role === 'user' ? "bg-gray-100 border-gray-100 text-gray-500" : "bg-orange-50 border-orange-100 text-orange-600"
                        )}>
                          {msg.role === 'user' ? <MessageCircle size={20} /> : <BrainCircuit size={20} />}
                        </div>
                        <div className={cn(
                          "max-w-[85%] rounded-[2rem] p-6 sm:p-8 shadow-sm border leading-relaxed",
                          msg.role === 'user' 
                            ? "bg-gray-950 text-white rounded-tr-none border-gray-900" 
                            : "bg-gray-50 text-gray-800 rounded-tl-none border-gray-100"
                        )}>
                          <div className="markdown-body text-sm sm:text-lg">
                            <Markdown>{msg.content}</Markdown>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  
                  {isProcessing && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start items-start gap-4 sm:gap-6"
                    >
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-[1.25rem] bg-orange-100 text-orange-600 flex items-center justify-center shadow-md border border-orange-100">
                        <BrainCircuit size={20} className="animate-pulse" />
                      </div>
                      <div className="bg-gray-50 rounded-[2rem] rounded-tl-none p-6 flex items-center gap-5 text-gray-400 border border-gray-100 shadow-sm min-w-[250px]">
                        <div className="flex gap-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-600">Deep Reasoning...</span>
                      </div>
                    </motion.div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-5 sm:p-8 bg-gray-50/50 border-t border-gray-100">
                  <form 
                    onSubmit={handleSendMessage}
                    className="flex items-center gap-3 sm:gap-4 bg-white rounded-3xl p-1.5 sm:p-2 shadow-2xl shadow-gray-200/50 border border-gray-200 focus-within:border-orange-500/50 transition-all focus-within:ring-4 focus-within:ring-orange-50"
                  >
                    <input
                      type="text"
                      className="flex-1 bg-transparent px-6 sm:px-8 py-5 outline-none text-gray-900 placeholder:text-gray-400 text-sm sm:text-lg font-bold"
                      placeholder={`Ask me anything in ${selectedLanguage}...`}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      id="chat-input"
                    />
                    <button
                      type="submit"
                      disabled={!inputValue.trim() || isProcessing}
                      className="bg-orange-600 text-white w-14 h-14 sm:w-20 sm:h-20 rounded-[1.5rem] sm:rounded-[2rem] hover:bg-orange-700 disabled:bg-gray-200 disabled:text-gray-400 transition-all flex items-center justify-center shadow-2xl shadow-orange-200 active:scale-90 group"
                      id="send-btn"
                    >
                      {isProcessing ? <Loader2 size={32} className="animate-spin" /> : <Send size={32} strokeWidth={2.5} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                    </button>
                  </form>
                </div>
              </div>
              <div className="bg-gray-950 py-5 px-10 rounded-b-[2rem] text-white text-[9px] sm:text-[11px] font-black uppercase tracking-[0.3em] flex items-center justify-between border-t border-white/5 shadow-2xl">
                <span className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_12px_rgba(34,197,94,0.8)]"></div>
                  Quantum Analysis Active
                </span>
                <span className="opacity-40">{selectedTone} Engine</span>
              </div>
            </motion.div>
          </div>
        )}
      </main>
      
      {/* Footer Info */}
      {!summary && (
        <footer className="w-full py-16 px-6 bg-white border-t border-gray-50 mt-10">
          <div className="max-w-7xl mx-auto space-y-16">
            {/* Tech Stack Marquee */}
            <div className="space-y-4">
              <p className="text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Built with Industry-Leading Tech</p>
              <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-12 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
                <div className="flex items-center gap-2 font-black text-xl tracking-tighter italic">REACT 18</div>
                <div className="flex items-center gap-2 font-black text-xl tracking-tighter italic text-orange-600">GEMINI AI</div>
                <div className="flex items-center gap-2 font-black text-xl tracking-tighter italic">TYPESCRIPT</div>
                <div className="flex items-center gap-2 font-black text-xl tracking-tighter italic">TAILWIND</div>
                <div className="flex items-center gap-2 font-black text-xl tracking-tighter italic">EXPRESS</div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-12">
              <div className="space-y-6 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-3">
                    <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center text-white shadow-lg">
                      <BrainCircuit size={18} />
                    </div>
                    <span className="font-black text-2xl tracking-tighter font-display uppercase italic">DocuMind</span>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-400 text-[10px] font-black tracking-[0.3em] uppercase flex items-center gap-3 justify-center md:justify-start">
                    <CheckCircle2 size={12} className="text-orange-500" />
                    Enterprise Intelligence • Privacy Safe
                  </p>
                  <p className="text-[10px] text-gray-300 font-bold max-w-xs leading-relaxed uppercase tracking-widest hidden md:block">
                    Full-stack document intelligence platform developed as a showcase for AI-powered productivity.
                  </p>
                </div>
              </div>
              
              <a 
                href="https://www.linkedin.com/in/rishabrai69/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex flex-col sm:flex-row items-center gap-6 bg-gray-50 border border-gray-200 px-10 py-6 sm:py-8 rounded-[3rem] group hover:border-orange-500/40 hover:bg-white transition-all shadow-xl shadow-gray-200/20 active:scale-95"
              >
                <div className="flex flex-col text-center sm:text-right space-y-0.5">
                  <span className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Contact the Developer</span>
                  <span className="text-2xl font-black text-gray-900 group-hover:text-orange-600 transition-colors font-display">Rishab Rai</span>
                </div>
                <div className="w-16 h-16 rounded-[1.5rem] bg-white border border-gray-200 flex items-center justify-center shadow-lg group-hover:shadow-2xl group-hover:border-orange-500/40 transition-all">
                  <Linkedin size={32} className="text-gray-400 group-hover:text-orange-600 transition-colors" />
                </div>
              </a>
            </div>

            <div className="pt-10 border-t border-gray-100 text-center">
              <div className="flex justify-center gap-4 mb-4">
                  {[1,2,3,4,5].map(i => <div key={i} className="w-1.5 h-1.5 bg-orange-200 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}></div>)}
              </div>
              <p className="text-[11px] font-black text-gray-300 uppercase tracking-[0.5em]">
                Verified Deployment • Asia-Southeast Production Cluster • 2026
              </p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

