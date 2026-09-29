// Route selection only. The authenticated materials RPC remains the permission check.
export function ownedLearnerMaterialApplication(view,application){
 return view==='learner'&&typeof application==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(application)?application:null;
}
