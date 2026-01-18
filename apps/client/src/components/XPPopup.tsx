import { useProgressStore } from '../store/progressStore';

export function XPPopup() {
  const { xpPopups } = useProgressStore();

  return (
    <>
      {xpPopups.map((popup) => (
        <div
          key={popup.id}
          className="fixed pointer-events-none z-[100] animate-float-up"
          style={{
            left: popup.x,
            top: popup.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <span className="font-pixel text-pixel-lg text-xp-fill drop-shadow-lg">
            +{popup.amount} XP
          </span>
        </div>
      ))}
    </>
  );
}
