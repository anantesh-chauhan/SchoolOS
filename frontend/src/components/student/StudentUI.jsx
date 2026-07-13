import React from 'react';
import { AlertCircle, ChevronRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Panel=({children,className=''})=><section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>{children}</section>;
export const Badge=({children,tone='indigo'})=><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tone==='green'?'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200':tone==='red'?'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200':'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200'}`}>{children}</span>;
export const PageTitle=({title,description,back})=><div className="flex items-start gap-3">{back&&<Link to={back} className="mt-1 rounded-xl border border-slate-200 p-2 dark:border-slate-700" aria-label="Back">←</Link>}<div><h1 className="text-2xl font-black text-slate-950 dark:text-white">{title}</h1>{description&&<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}</div></div>;
export const Loading=()=> <div className="flex min-h-64 items-center justify-center text-slate-500"><Loader2 className="mr-2 animate-spin"/>Loading your academic information…</div>;
export const ErrorState=({error,retry})=><Panel className="text-center"><AlertCircle className="mx-auto text-rose-500"/><p className="mt-3 font-bold">{error?.response?.data?.message||'Unable to load this page'}</p><button onClick={retry} className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white">Retry</button></Panel>;
export const Empty=({children})=><div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500 dark:border-slate-700">{children}</div>;
export const Progress=({value})=><div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-indigo-600" style={{width:`${Math.max(0,Math.min(100,value||0))}%`}}/></div>;
export const ActionLink=({to,children})=><Link to={to} className="inline-flex items-center gap-1 text-sm font-bold text-indigo-700 dark:text-indigo-300">{children}<ChevronRight size={15}/></Link>;
