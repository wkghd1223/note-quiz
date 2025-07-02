import Header from "@/components/layouts/header";
import GameControl from "@/components/game/GameControl";

export default function GameHeader() {
  return (
    <>
      {/* 헤더 */}
      <Header />

      {/* 게임 컨트롤 - 모바일에서만 */}
      <div className="md:hidden mt-4">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <GameControl />
        </div>
      </div>
    </>
  );
}
