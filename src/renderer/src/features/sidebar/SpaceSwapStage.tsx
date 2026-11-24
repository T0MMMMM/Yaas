import { Component, createRef, type ReactNode } from 'react'
import { strippedClone } from './dragLift'
import { endSpaceSwap, hidesIncoming, startSpaceSwap, type SpaceSwap } from './spaceSwap'

interface SpaceSwapStageProps {
  /** The space shown; when it changes, the old content fades out over the new (spaceSwap). */
  spaceId: string | null
  className?: string
  /** Places and fades out the old content's layer. */
  layerClassName?: string
  children: ReactNode
}

/**
 * The live content of the sidebar's space. A class component on purpose: only
 * getSnapshotBeforeUpdate runs after React rendered the new space but before it draws it, while
 * the DOM still shows the old space to copy.
 */
export class SpaceSwapStage extends Component<SpaceSwapStageProps> {
  private readonly content = createRef<HTMLDivElement>()
  private swap: SpaceSwap | null = null

  override getSnapshotBeforeUpdate(
    prev: SpaceSwapStageProps,
  ): { snapshot: HTMLElement | null } | null {
    const live = this.content.current
    if (!live || prev.spaceId === null || prev.spaceId === this.props.spaceId) return null
    return { snapshot: hidesIncoming(this.swap, performance.now()) ? null : strippedClone(live) }
  }

  override componentDidUpdate(
    _prev: SpaceSwapStageProps,
    _state: unknown,
    swapped: { snapshot: HTMLElement | null } | null,
  ): void {
    const live = this.content.current
    if (!swapped || !live) return
    this.swap = startSpaceSwap(live, swapped.snapshot, this.swap, this.props.layerClassName)
  }

  override componentWillUnmount(): void {
    endSpaceSwap(this.swap)
  }

  override render(): ReactNode {
    return (
      <div ref={this.content} className={this.props.className}>
        {this.props.children}
      </div>
    )
  }
}
