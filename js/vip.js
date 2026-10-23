const VIP_URL='https://ordvxiydkxbtahjpseph.supabase.co';
(function(){
 const plans={vip1:{label:'VIP 1 Hari',amount:20000},vip3:{label:'VIP 3 Hari',amount:35000},vip5:{label:'VIP 5 Hari',amount:45000},vip7:{label:'VIP 7 Hari',amount:50000},premium:{label:'Premium Permanen',amount:120000}};
 const fmt=n=>'Rp'+new Intl.NumberFormat('id-ID').format(n);
 const buttons=[...document.querySelectorAll('[data-plan]')]; let selected='vip1';
 function choose(btn){selected=btn.dataset.plan;buttons.forEach(x=>x.classList.toggle('selected',x===btn));const p=plans[selected];document.getElementById('vipPrice').textContent=p.label+' · '+fmt(p.amount)}
 buttons.forEach(btn=>btn.addEventListener('click',()=>choose(btn)));
 if(buttons.length)choose(buttons.find(x=>x.dataset.plan==='vip1')||buttons[0]);
 document.getElementById('continuePayment')?.addEventListener('click',()=>{if(!plans[selected])return;location.href='payment.html?plan='+encodeURIComponent(selected)});
})();