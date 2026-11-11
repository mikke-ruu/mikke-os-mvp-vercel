export function PublicOfferingPolicyLinks({href}:{href:string}){
 return <nav aria-label="販売条件と規約" className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-1 border-t border-[#e0e6df] px-3 py-5 text-xs">{[['commerce','特定商取引法に基づく表記'],['terms','利用規約'],['cancellation','キャンセル・返金ポリシー'],['privacy','プライバシーポリシー']].map(([id,label])=><a className="inline-flex min-h-11 items-center underline underline-offset-4" key={id} href={href+'#'+id}>{label}</a>)}</nav>;
}
