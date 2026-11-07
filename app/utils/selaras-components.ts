import type { Component } from 'vue'
import SAccordion from '@sewadah/selaras/components/Accordion.vue'
import SAlert from '@sewadah/selaras/components/Alert.vue'
import SAvatar from '@sewadah/selaras/components/Avatar.vue'
import SAvatarGroup from '@sewadah/selaras/components/AvatarGroup.vue'
import SBadge from '@sewadah/selaras/components/Badge.vue'
import SBreadcrumb from '@sewadah/selaras/components/Breadcrumb.vue'
import SButton from '@sewadah/selaras/components/Button.vue'
import SCallout from '@sewadah/selaras/components/Callout.vue'
import SCard from '@sewadah/selaras/components/Card.vue'
import SCardGroup from '@sewadah/selaras/components/CardGroup.vue'
import SChip from '@sewadah/selaras/components/Chip.vue'
import SCodeButton from '@sewadah/selaras/components/CodeButton.vue'
import SCodeTree from '@sewadah/selaras/components/CodeTree.vue'
import SCollapsible from '@sewadah/selaras/components/Collapsible.vue'
import SContainer from '@sewadah/selaras/components/Container.vue'
import SEmptyState from '@sewadah/selaras/components/EmptyState.vue'
import SFileTree from '@sewadah/selaras/components/FileTree.vue'
import SIcon from '@sewadah/selaras/components/Icon.vue'
import SKbd from '@sewadah/selaras/components/Kbd.vue'
import SNavigationMenu from '@sewadah/selaras/components/NavigationMenu.vue'
import SPagination from '@sewadah/selaras/components/Pagination.vue'
import SProgress from '@sewadah/selaras/components/Progress.vue'
import SReadMore from '@sewadah/selaras/components/ReadMore.vue'
import SScrollArea from '@sewadah/selaras/components/ScrollArea.vue'
import SSeparator from '@sewadah/selaras/components/Separator.vue'
import SSkeleton from '@sewadah/selaras/components/Skeleton.vue'
import SStepper from '@sewadah/selaras/components/Stepper.vue'
import STable from '@sewadah/selaras/components/Table.vue'
import STabs from '@sewadah/selaras/components/Tabs.vue'
import STimeline from '@sewadah/selaras/components/Timeline.vue'
import SToggle from '@sewadah/selaras/components/Toggle.vue'
import SToggleGroup from '@sewadah/selaras/components/ToggleGroup.vue'
import STree from '@sewadah/selaras/components/Tree.vue'

/**
 * Explicit Selaras imports for the Markdown renderer.
 *
 * Nuxt does not automatically make every Selaras component available to the
 * Comark runtime when it resolves tags dynamically, so the registry mapping is
 * resolved here instead of relying on `resolveComponent()`.
 */
export const selarasComponents: Record<string, Component> = {
  SAccordion,
  SAlert,
  SAvatar,
  SAvatarGroup,
  SBadge,
  SBreadcrumb,
  SButton,
  SCallout,
  SCard,
  SCardGroup,
  SChip,
  SCodeButton,
  SCodeTree,
  SCollapsible,
  SContainer,
  SEmptyState,
  SFileTree,
  SIcon,
  SKbd,
  SNavigationMenu,
  SPagination,
  SProgress,
  SReadMore,
  SScrollArea,
  SSeparator,
  SSkeleton,
  SStepper,
  STable,
  STabs,
  STimeline,
  SToggle,
  SToggleGroup,
  STree,
}
