import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <div className="bg-gradient-to-l from-accent to-accent-2 bg-clip-text text-7xl font-bold text-transparent">
        404
      </div>
      <h1 className="mt-4 text-2xl font-bold">الصفحة دي مش موجودة</h1>
      <p className="mt-2 text-muted">غالبًا اللينك فيه حرف زيادة. اختار الأداة اللي عايزها:</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary">البحث باليوزرنيم</Link>
        <Link href="/name" className="card px-5 py-3 font-semibold hover:border-accent">البحث بالاسم والشركة</Link>
        <Link href="/image" className="card px-5 py-3 font-semibold hover:border-accent">البحث بالصورة</Link>
      </div>
    </main>
  );
}
