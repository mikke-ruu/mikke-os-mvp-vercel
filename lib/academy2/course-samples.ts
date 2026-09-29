import { writeLessons } from '@/lib/academy/lesson-content';

export const courseSamples = [
  { id: 'experience', group: 'ハンドメイド', type: 'HANDMADE', name: 'はじめてのアクセサリー作り', audience: 'アクセサリー作りが初めてで、自分好みの作品を作ってみたい方', description: '道具の使い方とパーツの選び方を学び、ビーズのイヤリングを一組作ります。', lessons: ['道具とパーツをそろえる', '色とデザインを決める', 'イヤリングを組み立てる', '仕上げとお手入れ'] },
  { id: 'basic', group: '占い', type: 'TAROT', name: 'はじめてのタロット体験', audience: 'タロットに興味があり、まずは自分のためにカードを引いてみたい方', description: 'カードの基本と質問の立て方を知り、1枚引きで読み解く練習をします。', lessons: ['タロットの基本とカードの扱い方', '質問を整理して1枚引く', '絵柄から意味を読み取る', '気づきを記録する'] },
  { id: 'online', group: 'クッキング', type: 'COOKING', name: 'おうち発酵レッスン', audience: '発酵食品を料理に取り入れたい方、塩麹作りが初めての方', description: '衛生管理と発酵の基本を学び、塩麹を仕込んで日々の料理に使います。', lessons: ['発酵の基本と衛生管理', '材料と保存容器を準備する', '塩麹を仕込む', '発酵の観察と料理への使い方'] },
  { id: 'skill', group: '施術', type: 'HEAD CARE', name: 'ヘッドケア基礎講座', audience: 'ヘッドケアの手順と、安心して練習するための基礎を学びたい方', description: '施術前の確認事項と基本の手の動きを学び、相手の状態に配慮した練習をします。', lessons: ['施術前の確認と注意事項', '姿勢と手の当て方', '基本の手順を練習する', '施術後の確認と振り返り'] },
  { id: 'knowledge', group: '座学', type: 'KNOWLEDGE', name: '認定講座の基礎知識', audience: '認定取得を目指し、学習内容と認定基準を順番に理解したい方', description: '講座の考え方と基礎用語を学び、事例を通して知識を整理します。認定条件は販売プランで設定します。', lessons: ['学習の進め方と認定基準を知る', '基礎用語と考え方を学ぶ', '事例から理解を深める', '確認問題と学習の振り返り'] },
  { id: 'simple', group: 'レッスン', type: 'DANCE LESSON', name: '初心者向けダンスレッスン', audience: 'ダンスが初めてで、無理なく体を動かして楽しみたい方', description: 'ウォームアップから基本ステップ、短い振り付けまで、自分のペースで練習します。', lessons: ['ウォームアップと体の使い方', 'リズムと基本ステップ', '短い振り付けを練習する', 'クールダウンと振り返り'] },
] as const;
export function courseSampleDraft(id: string | null) {
  const sample = courseSamples.find(item => item.id === id);
  return {
    basic: { name: sample?.name ?? '', description: sample?.description ?? '', subtitle: '', duration_text: '', main_image_url: '' },
    settings: { targetAudience: sample?.audience ?? '', showIntroduction: true, sampleName: sample?.group ?? '' },
    blocks: writeLessons(sample ? sample.lessons.map((title, index) => ({ id: `sample-${sample.id}-${index}`, title, blocks: [] })) : []),
  };
}
