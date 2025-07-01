import Header from "@/components/layouts/header";
import Timer from "@/components/game/Timer";

export default function GameHeader() {
  return (
    <>
      {/* 헤더 */}
      <Header />

      {/* 타이머 - 모바일에서 헤더 아래 sticky */}
      <div className="md:hidden mt-4">
        <Timer className="mx-auto" />
      </div>
    </>
  );
}
