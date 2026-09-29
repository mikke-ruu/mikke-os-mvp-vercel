import type {AcademyPageTemplate} from './page-templates';
import type {LpBlock} from '@/components/mikkeos/page-builder/lp-design';

// UI06 v0.2's six choices. Example copy is editable; price/rights are never copied.
export const salesPageTemplateChoices = [
  {id:'handmade',label:'ハンドメイド・クラフト',heading:'Handmade\n& Craft',description:'作品写真や制作風景を大きく見せる構成。',title:'手を動かして、ひとつの作品を仕上げる',intro:'材料や道具の扱い方から、作品づくりの手順まで。自分のペースで制作を楽しめる講座です。',items:['材料と道具の基本を知る','ひとつずつ手順を確認する','自分らしい作品に仕上げる'],background:'#f4dfdb'},
  {id:'beauty',label:'美容・ウェルネス',heading:'Beauty\n& Wellness',description:'清潔感と変化が伝わるレッスン向け。',title:'日々のケアを、自分で選べるように',intro:'基本の考え方と実践の手順を学び、暮らしの中で続けられる方法を見つけます。',items:['今の習慣を振り返る','基本の手順を実践する','日々の取り入れ方を考える'],background:'#dfe3ff'},
  {id:'cooking',label:'食・料理',heading:'Food\n& Cooking',description:'完成写真や工程を魅力的に見せる構成。',title:'作る楽しさを、いつもの食卓へ',intro:'食材の選び方や下ごしらえから、仕上げまで。家庭でも試しやすい工程を学びます。',items:['食材と準備を確認する','調理のポイントを練習する','盛り付けとアレンジを楽しむ'],background:'#e7f3ef'},
  {id:'lesson',label:'レッスン・スクール',heading:'Lesson\n& School',description:'カリキュラムや学びの流れが伝わりやすい構成。',title:'はじめての一歩から、順番に学ぶ',intro:'基礎から実践まで、学ぶ順番を確認しながら進めます。初めての方にも取り組みやすい講座です。',items:['基礎を理解する','実践で確かめる','学んだことを振り返る'],background:'#f5e2ef'},
  {id:'session',label:'相談・セッション',heading:'Session\n& Consultation',description:'人柄、相談内容、安心感を中心にした構成。',title:'今の思いを整理して、次の一歩へ',intro:'気になっていることや取り組みたいことを伺いながら、一緒に整理する時間です。',items:['相談したいことを整理する','今できる選択肢を考える','次に取り組むことを決める'],background:'#ece7df'},
  {id:'business',label:'クリエイティブ・ビジネス',heading:'Creative\n& Business',description:'実績・内容・提供価値を整理して見せる構成。',title:'アイデアを、伝わる形にする',intro:'考えていることを整理し、必要な手順を学びながら具体的な形にしていきます。',items:['目的と相手を明確にする','構成と制作の手順を学ぶ','伝わり方を確認して整える'],background:'#e5ecff'},
] as const;

function exampleBlocks(choice:typeof salesPageTemplateChoices[number]):LpBlock[]{
  return [
    {id:choice.id+'-hero',type:'paragraph',lp:{desktop:{padding:44,background:choice.background,radius:13},mobile:{padding:22},children:[
      {id:choice.id+'-title',type:'heading',level:2,text:choice.title,lp:{desktop:{size:21,lineHeight:1.3},mobile:{size:21}}},
      {id:choice.id+'-intro',type:'paragraph',text:choice.intro,lp:{desktop:{size:11,lineHeight:1.8}}},
    ]}},
    {id:choice.id+'-learn',type:'paragraph',lp:{desktop:{padding:44},mobile:{padding:22},children:[
      {id:choice.id+'-learn-title',type:'heading',level:2,text:'この講座で学ぶこと',lp:{desktop:{size:21}}},
      {id:choice.id+'-points',type:'list',items:[...choice.items],lp:{desktop:{size:11,lineHeight:1.8}}},
    ]}},
    {id:choice.id+'-audience',type:'paragraph',lp:{desktop:{padding:44,background:'#faf9f7'},mobile:{padding:22},children:[
      {id:choice.id+'-audience-title',type:'heading',level:2,text:'こんな方へ',lp:{desktop:{size:21}}},
      {id:choice.id+'-audience-copy',type:'paragraph',text:'新しいことを始めたい方、基本から学び直したい方へ。対象となる方や、受講前に必要な経験をここに書き換えてください。',lp:{desktop:{size:11,lineHeight:1.8}}},
    ]}},
    {id:choice.id+'-faq',type:'paragraph',lp:{template:'faq',desktop:{padding:44},mobile:{padding:22},children:[
      {id:choice.id+'-question',type:'heading',level:3,text:'初めてでも参加できますか？',lp:{desktop:{size:14}}},
      {id:choice.id+'-answer',type:'paragraph',text:'例：初めての方にも基本からご案内します。必要な経験や準備物がある場合は、実際の講座内容に合わせて書き換えてください。',lp:{desktop:{size:11,lineHeight:1.8}}},
    ]}},
  ];
}
export const reviewedAcademyPageTemplates:AcademyPageTemplate[]=salesPageTemplateChoices.map(choice=>({id:choice.id,version:1,label:choice.label,targets:['sales_page'],blocks:exampleBlocks(choice)}));
