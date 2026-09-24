// Thin adapter so the rest of the app can render Bootstrap Icons
// (https://icons.getbootstrap.com, loaded via CDN in public/index.html)
// through the same <IconName size={16} color={..} /> call shape the
// codebase already uses everywhere. Each export below is a small wrapper
// around <i className="bi bi-...">.

function makeIcon(biName, { fillable = false, filledName } = {}) {
  const Icon = ({ size = 16, color, fill, style, className = '', title, onClick, ...rest }) => {
    const isFilled = fillable && fill && fill !== 'none';
    const cls = isFilled ? (filledName || `${biName}-fill`) : biName;
    return (
      <i
        className={`bi bi-${cls}${className ? ` ${className}` : ''}`}
        onClick={onClick}
        title={title}
        aria-hidden={title ? undefined : 'true'}
        style={{
          fontSize: size,
          lineHeight: 1,
          display: 'inline-block',
          flexShrink: 0,
          color: color || (isFilled ? fill : undefined) || 'currentColor',
          ...style,
        }}
        {...rest}
      />
    );
  };
  Icon.displayName = `BiIcon(${biName})`;
  return Icon;
}

export const LayoutDashboard = makeIcon('speedometer2');
export const InboxIcon = makeIcon('inbox');
export const Megaphone = makeIcon('megaphone');
export const RotateCcw = makeIcon('arrow-repeat');
export const CalendarIcon = makeIcon('calendar3');
export const ClipboardList = makeIcon('list-ol');
export const Users = makeIcon('people');
export const Contact = makeIcon('person-vcard');
export const Shield = makeIcon('shield-check');
export const Star = makeIcon('star', { fillable: true });
export const Smile = makeIcon('emoji-smile');
export const Bot = makeIcon('robot');
export const Receipt = makeIcon('file-text');
export const CreditCard = makeIcon('credit-card');
export const TrendingUp = makeIcon('bar-chart');
export const SettingsIcon = makeIcon('gear');
export const Bell = makeIcon('bell');
export const Sun = makeIcon('sun');
export const Moon = makeIcon('moon');
export const Search = makeIcon('search');
export const Menu = makeIcon('list');
export const ChevronLeft = makeIcon('chevron-left');
export const ChevronRight = makeIcon('chevron-right');
export const ChevronDown = makeIcon('chevron-down');
export const Zap = makeIcon('lightning-charge');
export const Sparkles = makeIcon('stars');
export const LogOut = makeIcon('box-arrow-right');
export const Download = makeIcon('download');
export const Upload = makeIcon('upload');
export const Clock = makeIcon('clock');
export const Send = makeIcon('send');
export const RotateCw = makeIcon('arrow-clockwise');
export const AlertTriangle = makeIcon('exclamation-triangle');
export const Plus = makeIcon('plus');
export const MessageSquare = makeIcon('chat');
export const Loader2 = makeIcon('arrow-repeat');
export const X = makeIcon('x');
export const ArrowUp = makeIcon('arrow-up');
export const ArrowDown = makeIcon('arrow-down');
export const Check = makeIcon('check');
export const Activity = makeIcon('activity');
export const UserPlus = makeIcon('person-plus');
export const Trash2 = makeIcon('trash');
export const Lock = makeIcon('lock');
export const Pencil = makeIcon('pencil');
export const Paperclip = makeIcon('paperclip');
export const ImageIcon = makeIcon('image');
export const ArrowLeft = makeIcon('arrow-left');
export const Eye = makeIcon('eye');
export const Palette = makeIcon('palette');
export const ArrowRight = makeIcon('arrow-right');
export const FileArchive = makeIcon('archive');
export const FileText = makeIcon('file-earmark-text');
export const CalendarPlus = makeIcon('calendar-plus');
export const BadgeCheck = makeIcon('patch-check');
export const Award = makeIcon('award');
export const Flag = makeIcon('flag');
export const MessageCircle = makeIcon('chat-dots');
export const Camera = makeIcon('camera');
export const EyeOff = makeIcon('eye-slash');
export const Monitor = makeIcon('display');
export const Smartphone = makeIcon('phone');
export const QrCode = makeIcon('qr-code');
export const Copy = makeIcon('clipboard');
export const ShieldCheck = makeIcon('shield-fill-check');
export const KeyRound = makeIcon('key');
export const TrendingDown = makeIcon('graph-down');
export const PhoneOff = makeIcon('telephone-x');
export const FileWarning = makeIcon('file-earmark-x');
export const Quote = makeIcon('quote');
export const Building2 = makeIcon('building');
export const Plug = makeIcon('plug');
export const Phone = makeIcon('telephone');
export const PartyPopper = makeIcon('stars');
export const CheckCircle2 = makeIcon('check-circle-fill');
export const CalendarClock = makeIcon('calendar-check');
export const User = makeIcon('person');
export const Stethoscope = makeIcon('heart-pulse');
export const Info = makeIcon('info-circle');
export const Home = makeIcon('house');
export const PenLine = makeIcon('pencil-square');
export const PillIcon = makeIcon('capsule');
export const LifeBuoy = makeIcon('life-preserver');
