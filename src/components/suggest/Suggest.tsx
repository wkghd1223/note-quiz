const GunHee = () => {
  return (
    <main className="bg-[#222a48] p-2 text-center">
      <h2 className="text-gray-100 text-2xl font-bold">건희</h2>
      <div className="p-3">
        <textarea className="w-full" placeholder="내용" />
      </div>
      <div className="p-3">
        <textarea className="w-full" placeholder="내용" />
      </div>
      <div className="p-3 flex gap-3">
        <button className="bg-gray-100 w-full">취소</button>
        <button className="bg-gray-100 w-full">확인</button>
      </div>
    </main>
  );
};

export default GunHee;
