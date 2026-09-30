'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, Home, Megaphone, Menu, X } from 'lucide-react';
import { DemoArticleEditor } from './DemoArticleEditor';
import { courseSamples, courseSampleDraft } from '@/lib/academy2/course-samples';
import { readLessons, writeLessons, type AcademyLesson } from '@/lib/academy/lesson-content';
import type { AcademyPageBlock } from '@/types/database';
import { demoHref, loadDemo, persistDemo, type DemoCourse, type DemoData, type DemoPlan } from './demo-store';
import styles from './demo.module.css';

const kinds = ['ワークショップ', '単品講座', 'コース', '全講座', '月額レッスン'];
const steps = ['講座・順番', '受講スタイル', '金額・支払い', '受講後', '申込フォーム', '確認・販売ページ'];
const now = () => new Date().toISOString();
const yen = (raw: string) => raw === '' ? '未設定' : `¥${Number(raw).toLocaleString('ja-JP')}`;

export function AcademyDemo() {
  const query = useSearchParams();
  const router = useRouter();
  const view = query.get('view') ?? 'home';
  const id = query.get('id') ?? '';
  const [data, setData] = useState<DemoData | null>(null);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(false);
  useEffect(() => { setData(loadDemo()); }, []);
  function save(next: DemoData) {
    try { persistDemo(next); setData(next); setError(''); return true; }
    catch { setError('ブラウザへの保存に失敗しました。画像サイズや空き容量を確認してください。'); return false; }
  }
  if (!data) return <p role="status" className={styles.loading}>デモを読み込んでいます…</p>;
  const course = data.courses.find(item => item.id === id);
  const plan = data.plans.find(item => item.id === id);
  const current = view.startsWith('course') || view === 'materials' ? 'courses' : view.startsWith('plan') || view === 'sales-page' ? 'plans' : view;
  return <div className={styles.app}>
    <aside className={`${styles.side} ${menu ? styles.sideOpen : ''}`}>
      <div className={styles.brand}>mikkeOS <small>Academy 2.0 DEMO</small></div>
      <button className={styles.mobileClose} onClick={() => setMenu(false)} aria-label="メニューを閉じる"><X size={20}/></button>
      <nav aria-label="デモメニュー">
        <Link href={demoHref('home')} aria-current={current === 'home' ? 'page' : undefined} onClick={() => setMenu(false)}><Home size={19}/>ホーム</Link>
        <Link href={demoHref('courses')} aria-current={current === 'courses' ? 'page' : undefined} onClick={() => setMenu(false)}><BookOpen size={19}/>講座</Link>
        <Link href={demoHref('plans')} aria-current={current === 'plans' ? 'page' : undefined} onClick={() => setMenu(false)}><Megaphone size={19}/>販売プラン</Link>
      </nav>
      <p className={styles.sideNote}>架空データだけを使うデモです。入力内容はこのブラウザに保存されます。</p>
    </aside>
    <div className={styles.workspace}>
      <header className={styles.top}><button className={styles.mobileMenu} onClick={() => setMenu(true)} aria-label="メニューを開く"><Menu size={21}/></button><strong>サンプルアカデミー</strong><span>デモ環境</span></header>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.content}>
        {view === 'home' && <DemoHome data={data}/>}
        {view === 'courses' && <DemoCourses data={data}/>}
        {view === 'course-new' && <DemoCourseEditor key={`new:${query.get('sample')}`} sample={query.get('sample')} data={data} save={save} onDone={courseId => router.push(demoHref('course', courseId))}/>}
        {view === 'course' && (course ? <DemoCourseEditor key={id} course={course} data={data} save={save} onDone={courseId => router.push(demoHref('course', courseId))}/> : <Missing href={demoHref('courses')}/>)}
        {view === 'materials' && (course ? <DemoMaterials key={id} course={course} data={data} save={save}/> : <Missing href={demoHref('courses')}/>)}
        {view === 'plans' && <DemoPlans data={data}/>}
        {view === 'plan-new' && <DemoPlanNew data={data} save={save} onDone={planId => router.push(demoHref('plan', planId))}/>}
        {view === 'plan' && (plan ? <DemoPlanEditor key={id} plan={plan} data={data} save={save}/> : <Missing href={demoHref('plans')}/>)}
        {view === 'sales-page' && (plan ? <DemoSalesPage key={id} plan={plan} data={data} save={save}/> : <Missing href={demoHref('plans')}/>)}
      </div>
    </div>
  </div>;
}

function Missing({ href }: { href: string }) { return <div className={styles.card}><p>このデモデータは見つかりませんでした。</p><Link href={href}>一覧へ戻る</Link></div>; }
function Heading({ en, children }: { en: string; children: React.ReactNode }) { return <div className={styles.titlebar}><b>{en}</b><h1>{children}</h1></div>; }

function DemoHome({ data }: { data: DemoData }) {
  return <main className={styles.page}>
    <div className={styles.identity}><small>MY ACADEMY</small><strong>サンプルアカデミー</strong><span>Academy 2.0 デモ</span></div>
    <div className={styles.hero}><strong>サンプルアカデミー</strong><p>教える内容を作り、販売プランへつなげましょう。</p></div>
    <section className={styles.homeSection}><div className={styles.eyebrow}>GET STARTED</div><h2>はじめてのAcademy</h2><div className={styles.startGrid}>
      <Link href={demoHref('course-new')}><small>STEP 01</small><strong>講座をつくる</strong></Link>
      <Link href={demoHref('plan-new')}><small>STEP 02</small><strong>販売をつくる</strong></Link>
      <Link href={demoHref('plans')}><small>STEP 03</small><strong>販売ページを見る</strong></Link>
      <div><small>STEP 04</small><strong>公開する</strong><span>デモでは公開しません</span></div>
    </div></section>
    <div className={styles.homeGrid}><section className={styles.card}><div className={styles.eyebrow}>TO DO</div><h2>やること</h2><p>作成中の講座と販売プランを確認しましょう。</p><Link href={demoHref('courses')}>講座 {data.courses.length}件 →</Link><Link href={demoHref('plans')}>販売プラン {data.plans.length}件 →</Link></section><section className={styles.card}><div className={styles.eyebrow}>UP NEXT</div><h2>開催予定</h2><p>このデモには開催予定はありません。</p></section></div>
  </main>;
}

function DemoCourses({ data }: { data: DemoData }) {
  const [query, setQuery] = useState(''); const [modal, setModal] = useState(false);
  const rows = data.courses.filter(item => item.name.includes(query));
  return <main className={styles.page}><Heading en="COURSES">講座</Heading><div className={styles.headbox}><p>教える内容とレッスン教材を管理します。<br/>価格や販売方法は販売プランで設定します。</p><button className={styles.primary} onClick={() => setModal(true)}>＋ 講座をつくる</button></div>
    <div className={styles.toolbar}><input aria-label="講座名で検索" placeholder="講座名で検索" value={query} onChange={e => setQuery(e.target.value)}/><span>{rows.length}件</span></div>
    <div className={styles.list}>{rows.map((course, index) => <Link href={demoHref('course', course.id)} key={course.id} className={styles.listRow}><span className={styles.thumb}>{String(index + 1).padStart(2, '0')}</span><span><strong>{course.name}</strong><small>{readLessons(course.blocks).length}レッスン ・ 参考価格 {yen(course.referencePrice)}</small></span><b>›</b></Link>)}</div>
    {modal && <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="講座の作り方"><div className={styles.modal}><h2>講座をつくる</h2><div className={styles.choices}><Link href={demoHref('course-new', undefined, 'experience')}>見本からつくる<small>具体例を使って始めます</small></Link><Link href={demoHref('course-new')}>まっさらからつくる<small>自分の内容で始めます</small></Link></div><button onClick={() => setModal(false)}>閉じる</button></div></div>}
  </main>;
}

function DemoCourseEditor({ course, sample, data, save, onDone }: { course?: DemoCourse; sample?: string | null; data: DemoData; save: (data: DemoData) => boolean; onDone: (id: string) => void }) {
  const draft = courseSampleDraft(sample ?? null);
  const [form, setForm] = useState<DemoCourse>(() => course ? structuredClone(course) : { id: crypto.randomUUID(), name: draft.basic.name, description: draft.basic.description, subtitle: draft.basic.subtitle, targetAudience: draft.settings.targetAudience, duration: draft.basic.duration_text, referencePrice: '', blocks: draft.blocks, updatedAt: now() });
  const [status, setStatus] = useState('');
  const update = (key: keyof DemoCourse, value: string) => { setForm(current => ({ ...current, [key]: value })); setStatus('未保存の変更があります'); };
  function submit(nextView?: 'materials') {
    if (!form.name.trim()) { setStatus('講座名を入力してください'); return; }
    if (form.referencePrice !== '' && (!/^\d+$/.test(form.referencePrice) || !Number.isSafeInteger(Number(form.referencePrice)))) { setStatus('単品参考価格は0円以上の整数で入力してください'); return; }
    const next = { ...form, updatedAt: now() };
    if (save({ ...data, courses: [next, ...data.courses.filter(item => item.id !== next.id)] })) {
      setForm(next); setStatus('保存しました');
      if (nextView === 'materials') window.location.assign(demoHref('materials', next.id));
      else if (!course) onDone(next.id);
    }
  }
  return <main className={styles.page}><Link className={styles.back} href={demoHref('courses')}>← 講座一覧へ</Link><Heading en="COURSE EDITOR">講座編集</Heading><div className={styles.editHead}><div><strong>{form.name || '新しい講座'}</strong><small>教える内容と教材を作ります</small></div><button className={styles.primary} onClick={() => submit()}>保存する</button></div><p role="status" className={styles.status}>{status || (course ? '保存済みの講座です' : '入力内容は未保存です')}</p>
    <nav className={styles.tabs} aria-label="講座編集項目"><span aria-current="page">基本情報</span><button onClick={() => submit('materials')}>レッスン・教材</button></nav>
    <div className={styles.twoColumns}><section className={styles.card}><h2>基本情報</h2><p className={styles.hint}>まずは「何を教える講座なのか」を登録します。</p>
      <label>講座名<input value={form.name} onChange={e => update('name', e.target.value)}/></label>
      <label>この講座では何を学べますか？<textarea value={form.description} onChange={e => update('description', e.target.value)}/></label>
      <label>こんな方におすすめ<textarea value={form.targetAudience} onChange={e => update('targetAudience', e.target.value)}/></label>
      <label>カード用の短い紹介文<input value={form.subtitle} onChange={e => update('subtitle', e.target.value)}/></label>
      <label>目安の学習時間<input value={form.duration} onChange={e => update('duration', e.target.value)}/></label>
      <label>単品参考価格<input inputMode="numeric" value={form.referencePrice} onChange={e => update('referencePrice', e.target.value)}/><small>実際の販売価格は販売プランで設定します。</small></label>
      <button className={styles.secondary} onClick={() => submit('materials')}>レッスン・教材設定へ →</button>
    </section><aside className={styles.card}><h2>この講座について</h2><p>講座は「教える内容」です。金額・販売方法・開催方法は販売プランで設定します。</p><h3>講座カードのプレビュー</h3><div className={styles.previewCard}><small>COURSE 01</small><strong>{form.name || '講座名'}</strong><p>{form.subtitle || form.description || '紹介文が表示されます'}</p></div>{course && <Link href={demoHref('plan-new')}>販売プランをつくる →</Link>}</aside></div>
  </main>;
}

function DemoMaterials({ course, data, save }: { course: DemoCourse; data: DemoData; save: (data: DemoData) => boolean }) {
  const [lessons, setLessons] = useState<AcademyLesson[]>(() => readLessons(course.blocks));
  const [selected, setSelected] = useState(0); const [dirty, setDirty] = useState(false); const [error, setError] = useState('');
  const lesson = lessons[selected];
  function update(index: number, value: Partial<AcademyLesson>) { setLessons(current => current.map((item, i) => i === index ? { ...item, ...value } : item)); setDirty(true); }
  function submit() { const next = { ...course, blocks: writeLessons(lessons), updatedAt: now() }; if (save({ ...data, courses: data.courses.map(item => item.id === course.id ? next : item) })) { setDirty(false); setError(''); } else setError('保存できませんでした'); }
  return <main className={styles.materialPage}><div className={styles.materialHeader}><Link href={demoHref('course', course.id)}>← 基本情報へ</Link><div><small>レッスン・教材</small><strong>{course.name}</strong></div><button className={styles.primary} onClick={submit}>{dirty ? '保存する' : '保存済み'}</button></div><div className={styles.materialGrid}><aside className={styles.lessonNav}><h2>講座の目次</h2>{lessons.map((item, index) => <div className={styles.lessonItem} key={item.id}><button className={index === selected ? styles.selectedLesson : ''} onClick={() => setSelected(index)}><small>{String(index + 1).padStart(2, '0')}</small><strong>{item.title || '新しいレッスン'}</strong></button></div>)}<button className={styles.secondary} onClick={() => { setLessons(current => [...current, { id: crypto.randomUUID(), title: '新しいレッスン', blocks: [] }]); setSelected(lessons.length); setDirty(true); }}>＋ レッスンを追加</button></aside><div className={styles.materialCanvas}>{lesson ? <><label className={styles.lessonTitle}>レッスン名<input value={lesson.title} onChange={e => update(selected, { title: e.target.value })}/></label><DemoArticleEditor title={lesson.title} blocks={lesson.blocks as AcademyPageBlock[]} onChange={blocks => update(selected, { blocks })} onSave={submit} onBack={() => window.location.assign(demoHref('course', course.id))} dirty={dirty} error={error}/></> : <p>左の「レッスンを追加」から始めてください。</p>}</div></div></main>;
}

function DemoPlans({ data }: { data: DemoData }) { const [query, setQuery] = useState(''); return <main className={styles.page}><Heading en="SALES PLANS">販売プラン</Heading><div className={styles.headbox}><p>作った講座を選び、価格と売り方を設定します。</p><Link className={styles.primary} href={demoHref('plan-new')}>＋ 販売プランをつくる</Link></div><div className={styles.toolbar}><input aria-label="販売プラン名で検索" placeholder="販売プラン名で検索" value={query} onChange={e => setQuery(e.target.value)}/></div><div className={styles.list}>{data.plans.filter(plan => plan.title.includes(query)).map(plan => <Link href={demoHref('plan', plan.id)} key={plan.id} className={styles.listRow}><span className={styles.thumb}>◉</span><span><strong>{plan.title || '名称未設定'}</strong><small>{plan.kind} ・ {yen(plan.price)} ・ {plan.courseIds.length}講座</small></span><b>›</b></Link>)}</div></main>; }
function DemoPlanNew({ data, save, onDone }: { data: DemoData; save: (data: DemoData) => boolean; onDone: (id: string) => void }) {
  function create(kind: string) { const item: DemoPlan = { id: crypto.randomUUID(), title: '', kind, courseIds: [], studyStyle: '講師と学ぶ', methods: [], price: '', payment: '銀行振込', after: [], formQuestion: '', pageIntro: '', updatedAt: now() }; if (save({ ...data, plans: [item, ...data.plans] })) onDone(item.id); }
  return <main className={styles.page}><Link className={styles.back} href={demoHref('plans')}>← 販売プラン一覧へ</Link><Heading en="CHOOSE A SALES PLAN">どんな売り方をしますか？</Heading><div className={styles.choiceGrid}>{kinds.map(kind => <button key={kind} className={styles.choice} onClick={() => create(kind)}><strong>{kind}</strong><span>この販売タイプで6STEPを始める →</span></button>)}</div></main>;
}

function DemoPlanEditor({ plan, data, save }: { plan: DemoPlan; data: DemoData; save: (data: DemoData) => boolean }) {
  const [form, setForm] = useState<DemoPlan>(() => structuredClone(plan)); const [step, setStep] = useState(0); const [dirty, setDirty] = useState(false); const [message, setMessage] = useState('');
  const selected = useMemo(() => form.courseIds.map(id => data.courses.find(course => course.id === id)).filter((course): course is DemoCourse => !!course), [form.courseIds, data.courses]);
  const reference = selected.length && selected.every(course => course.referencePrice !== '') ? selected.reduce((sum, course) => sum + Number(course.referencePrice), 0) : null;
  function patch(value: Partial<DemoPlan>) { setForm(current => ({ ...current, ...value })); setDirty(true); setMessage('未保存の変更があります'); }
  function submit() { const next = { ...form, updatedAt: now() }; if (save({ ...data, plans: data.plans.map(item => item.id === plan.id ? next : item) })) { setForm(next); setDirty(false); setMessage('保存しました'); } }
  function toggle(id: string) { patch({ courseIds: form.courseIds.includes(id) ? form.courseIds.filter(value => value !== id) : [...form.courseIds, id] }); }
  return <main className={styles.page}><Link className={styles.back} href={demoHref('plans')}>← 販売プラン一覧へ</Link><Heading en="SALES PLAN">{form.kind}をつくる</Heading><p className={styles.intro}>質問に答えていけば、販売プランが完成します。</p><nav className={styles.stepTabs} aria-label="作成STEP">{steps.map((name, i) => <button key={name} aria-current={step === i ? 'step' : undefined} onClick={() => setStep(i)}>{i + 1} {name}</button>)}</nav><div className={styles.twoColumns}><section className={styles.card}>
    {step === 0 && <><h2>講座を選んで、受講する順番を決める</h2><label>販売プラン名<input value={form.title} onChange={e => patch({ title: e.target.value })} placeholder="販売プラン名"/></label><h3>講座を選ぶ</h3>{data.courses.map(course => <label className={styles.checkRow} key={course.id}><input type="checkbox" checked={form.courseIds.includes(course.id)} onChange={() => toggle(course.id)}/><span>{course.name}<small>単品参考価格 {yen(course.referencePrice)}</small></span></label>)}{!data.courses.length && <Link href={demoHref('course-new')}>まず講座をつくる →</Link>}</>}
    {step === 1 && <><h2>どうやって受講しますか？</h2><label>受講スタイル<select value={form.studyStyle} onChange={e => patch({ studyStyle: e.target.value })}><option>講師と学ぶ</option><option>教材で学ぶ</option></select></label>{form.studyStyle === '講師と学ぶ' && <fieldset><legend>開催方法</legend>{['対面', 'オンライン'].map(method => <label className={styles.checkRow} key={method}><input type="checkbox" checked={form.methods.includes(method)} onChange={() => patch({ methods: form.methods.includes(method) ? form.methods.filter(value => value !== method) : [...form.methods, method] })}/>{method}</label>)}</fieldset>}</>}
    {step === 2 && <><h2>金額と支払い方法を決める</h2><p>単品参考価格合計：{reference === null ? '未設定' : `¥${reference.toLocaleString('ja-JP')}`}</p><label>{form.kind === '月額レッスン' ? '月額料金' : '販売価格'}<input type="number" min="0" inputMode="numeric" value={form.price} onChange={e => patch({ price: e.target.value })}/>円</label><label>支払い方法<select value={form.payment} onChange={e => patch({ payment: e.target.value })}><option>銀行振込</option><option>外部決済</option></select></label><p className={styles.hint}>デモでは実際の決済は行いません。</p></>}
    {step === 3 && <><h2>受講後はどうしますか？</h2><p>説明会用デモでは設定内容の表示だけを確認できます。</p>{['修了記録', '認定証', '商用利用'].map(value => <label className={styles.checkRow} key={value}><input type="checkbox" checked={form.after.includes(value)} onChange={() => patch({ after: form.after.includes(value) ? form.after.filter(item => item !== value) : [...form.after, value] })}/>{value}</label>)}</>}
    {step === 4 && <><h2>申込フォームを設定する</h2><p>お名前・メールアドレスは基本項目です。</p><label>追加の質問<textarea value={form.formQuestion} onChange={e => patch({ formQuestion: e.target.value })} placeholder="例：作ってみたい色を教えてください"/></label></>}
    {step === 5 && <><h2>内容を確認して、販売ページへ</h2><dl className={styles.summary}><div><dt>販売タイプ</dt><dd>{form.kind}</dd></div><div><dt>講座</dt><dd>{selected.map(course => course.name).join(' → ') || '未設定'}</dd></div><div><dt>販売価格</dt><dd>{yen(form.price)}</dd></div><div><dt>支払い</dt><dd>{form.payment}</dd></div></dl><Link className={styles.secondary} href={demoHref('sales-page', form.id)} onClick={event => { if (dirty) { event.preventDefault(); setMessage('先に保存してください'); } }}>販売ページを見る →</Link></>}
    <div className={styles.actions}><button className={styles.secondary} disabled={step === 0} onClick={() => setStep(step - 1)}>戻る</button><button className={styles.primary} onClick={submit}>保存する</button><button className={styles.secondary} disabled={step === 5} onClick={() => setStep(step + 1)}>次へ →</button></div><p role="status">{message || '保存済みです'}</p>
  </section><aside className={styles.card}><h2>現在選んでいる講座</h2>{selected.length ? selected.map((course, index) => <p key={course.id}>{String(index + 1).padStart(2, '0')} {course.name}<br/><small>参考価格 {yen(course.referencePrice)}</small></p>) : <p>講座を選ぶとここに表示されます。</p>}<hr/><p>販売価格：{yen(form.price)}</p></aside></div></main>;
}

function DemoSalesPage({ plan, data, save }: { plan: DemoPlan; data: DemoData; save: (data: DemoData) => boolean }) {
  const [intro, setIntro] = useState(plan.pageIntro); const [saved, setSaved] = useState(true);
  const courses = plan.courseIds.map(id => data.courses.find(course => course.id === id)).filter((course): course is DemoCourse => !!course);
  function submit() { const next = { ...plan, pageIntro: intro, updatedAt: now() }; if (save({ ...data, plans: data.plans.map(item => item.id === plan.id ? next : item) })) setSaved(true); }
  return <main className={styles.page}><Link className={styles.back} href={demoHref('plan', plan.id)}>← 販売プランへ戻る</Link><Heading en="SALES PAGE">販売ページ</Heading><div className={styles.editHead}><p>標準ページの文章を編集できます。デモから公開・申込は行いません。</p><button className={styles.primary} onClick={submit}>保存する</button></div><div className={styles.twoColumns}><section className={styles.card}><h2>標準ページ</h2><label>紹介文<textarea value={intro} onChange={e => { setIntro(e.target.value); setSaved(false); }}/></label><p role="status">{saved ? '保存済みです' : '未保存の変更があります'}</p></section><aside className={styles.salesPreview}><div className={styles.browserBar}>販売ページのプレビュー</div><div className={styles.salesBody}><small>サンプルアカデミー</small><h2>{plan.title || '販売プラン名'}</h2><p>{intro || '紹介文を入力してください'}</p><h3>学べる内容</h3>{courses.map(course => <p key={course.id}>・{course.name}</p>)}<h3>料金</h3><strong>{yen(plan.price)}</strong><p className={styles.hint}>このページはデモ表示です。</p></div></aside></div></main>;
}
