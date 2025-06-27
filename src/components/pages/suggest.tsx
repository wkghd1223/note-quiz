import Button from '@/components/forms/button';
import Textarea from '@/components/forms/textarea';

const GunHee = () => {
  return (
    <main className="bg-[#222a48] p-2 text-center">
      <h2 className="text-gray-100 text-2xl font-bold">건희</h2>
      <div className="p-3">
        <Textarea className="w-full" placeholder="내용" />
      </div>
      <div className="p-3">
        <Textarea className="w-full" placeholder="내용" />
      </div>
      <div className="p-3 flex gap-3">
        <Button className="bg-gray-100 w-full">취소</Button>
        <Button className="bg-gray-100 w-full">확인</Button>
      </div>
    </main>
  );
};

export default GunHee;
