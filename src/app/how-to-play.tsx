import { GuidePage } from '@/components/GuidePage';
import { GUIDES } from '@/content/guide';

/** The route exists so the export writes the file; the page itself is shared by all three. */
export default function Screen() {
  return <GuidePage guide={GUIDES['en']} />;
}
