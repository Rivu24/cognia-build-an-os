# How we teach: the Ground Up method

Build an OS teaches operating-system development from power-on to a self-hosting system. The reading is the OSDev Wiki, copied word for word. Our work is the order, the framing around each article, and the checkpoints. We do not rewrite the wiki. Its contributors spent two decades getting it right, and every page here credits them.

In one line, the method is: **remove the reasons beginners quit, in the order they hit them, using one kernel that never gets thrown away.**

## Why beginners quit

Few people stop because a concept is too hard. They stop because of a handful of failures that pile up:

1. **Missing basics.** Weak hex, assembly or calling-convention knowledge turns into bugs they cannot diagnose.
2. **Toolchain pain.** The host compiler, a broken linker script, an image that will not boot. Hours go by before any kernel code exists.
3. **Silent crashes.** A triple fault resets the machine with no output, and debugging turns into random edits.
4. **No sense of order.** "What next?" after the first kernel. A GUI before memory management.
5. **Early choices that are expensive to undo.** A custom bootloader, a microkernel with no IPC plan, switching to 64-bit halfway through.

The core path deals with these one at a time, in that order.

## Core principles

**A first win before the theory.** In about the fourth hour, before any cross-compiler, you boot a 512-byte boot sector you wrote yourself. *Why:* it shows the whole chain works (assembler, image, emulator, firmware), and that carries you through the toolchain work that follows.

**Foundations for C programmers.** Numbers and endianness, x86 registers and assembly syntax, and the stack with calling conventions come before any kernel code. Object files, linker scripts and freestanding C come before Bare Bones. *Why:* every interrupt stub and context switch you write later is a precise edit of registers and the stack. Learners who cannot read those guess.

**Debugging before features.** A whole track, the Crash Reporter, comes right after the first boot and before IRQs, memory or tasks. It covers serial logging, kprintf, GDB, the GDT and IDT taught as crash-reporting infrastructure, triple-fault diagnosis, stack traces, SSP and UBSan. *Why:* once every crash prints a vector, an address and a backtrace, bugs become things you can find rather than things you suffer through.

**Concept, then mechanism, then policy.** You read *Interrupts* before you build the IDT, and *Paging* before *Setting Up Paging*. The context switch comes before the scheduler, the frame allocator before the heap, and the VFS before any disk filesystem. *Why:* you can only debug a mechanism if you can say what it is supposed to do.

**One kernel, always bootable.** Every checkpoint adds to the same project. At the end of each module it still boots and passes its tests. *Why:* throwaway exercises teach the steps but not the integration, and integration is where kernels fail.

**One route, with alternatives labelled.** The core path assumes C, 32-bit x86, GRUB with Multiboot, and BIOS in QEMU. *Why:* the wiki's core tutorials (GDT Tutorial, Setting Up Paging, Higher Half x86 Bare Bones, Getting to Ring 3, ELF Tutorial) are written for exactly that setup. 64-bit comes later as a planned port of your existing kernel in an elective, never as a switch in the middle of the core.

**Decisions on paper, revisited later.** You keep a `DECISIONS.md`. It gets three entries: language, architecture and boot route (confirmed at the end of the Workbench), your kernel model (chosen after the heap, before processes), and your lock order. The Design Revisited elective comes back to each one once you have built the parts. *Why:* early choices made on trust should be checked against experience, not defended out of habit.

## Learner journey

| Stage | Track | You leave with |
|---|---|---|
| Ready | 1 Orientation and Foundations | A scoped goal, your own boot sector, the ability to read registers and stack frames |
| Equipped | 2 Workbench | An i686-elf cross-compiler, freestanding libk, linker scripts, DECISIONS.md |
| Booted | 3 First Boot | A Multiboot kernel that prints, port I/O, Meaty Skeleton layout, `make run` |
| Unafraid | 4 Crash Reporter | Serial log, kprintf, GDB, exception dumps, panic with backtrace, `make test` |
| Responsive | 5 Interrupts, Time and Input | PIC, timer, wall-clock time, keyboard |
| Addressed | 6 Memory | Frame allocator, paging, higher half, map/unmap, heap, kernel-model decision |
| Concurrent | 7 Multitasking | Context switch, preemptive scheduler, locks proven by failing tests |
| Multi-program | 8 User Space | Ring 3, syscalls, initrd, ELF loader, spawn/wait, fd tables and pipes, libc, shell |
| Persistent | 9 Storage | VFS, partitions, PCI, ATA, FAT read and write, ext2, ISO 9660 |
| Your direction | 10 to 16 Electives | Drivers and buses, ACPI/APIC/SMP, graphics and sound, networking, porting and self-hosting, 64-bit/UEFI/ARM/RISC-V, Design Revisited |

The core path is 75 lessons, about 73 hours of reading and first builds. The electives add 57 lessons.

## Anatomy of a lesson page

Each lesson is one sitting. Long articles are split across sittings: Brendan's Multi-tasking Tutorial (steps 1 to 4, 5 to 9, then 10 to 12), the keyboard (scan codes, then the 8042), FAT (read, then write) and USB. The blocks appear in this order:

1. **Header.** Title, level (Beginner, Medium, Advanced, Master), time estimate, and prerequisite links that show done or not done. The time covers reading plus a first working build, not polishing.
2. **Recall.** Two or three questions drawn from the objectives of the prerequisite lessons ("Can you still decode a page fault error code?"), each linking back to its lesson. There is no score.
3. **Why this matters now.** One or two plain sentences.
4. **Objectives.** Two to four testable "After this lesson you can..." statements.
5. **Reading.** The wiki article(s), verbatim, with headings, code, tables and images kept. Each one opens with a credit line: the article title, a link to the original on wiki.osdev.org, and "OSDev Wiki contributors, CC0". The wiki's own rating and its stub, in-progress and beginner-warning flags are shown as they are. Code blocks in tutorials have no copy button by default, following the wiki's own warning against copy-paste kernels. You can turn the button on.
6. **Checkpoint.** One concrete task with a pass condition you can observe. Parts are labelled **Predict**, **Break it** and **Harness test** where they apply.
7. **Stuck?** Fixed links on every lesson: Troubleshooting, Triple Fault, Kernel Debugging, I Can't Get Interrupts Working, My Bootloader Does Not Work, the known-bugs pages for the James Molloy, Bran and Brokenthorn tutorials, and the Posting Checklist.
8. **Further reading.** Up to six optional articles, clearly marked optional.
9. **Footer.** Previous and next, OSDev Wiki attribution, and the Cognia Labs copyright.

## Difficulty and prerequisites

- Levels follow the wiki's scale. The core path tops out at Advanced. Master-level work (AML, SMP startup, USB controllers, HD Audio, self-hosting) appears only in electives, and those lessons say when porting a library beats writing one.
- Each lesson lists the specific earlier lessons it needs, marked done or not done,, not "the previous track". Prerequisites form a graph, not a chain, so electives open as soon as they safely can. FAT reading needs the VFS and partitions; FAT writing adds ATA, not NVMe. The APIC needs ACPI tables. SMP needs the APIC timer and locks. The framebuffer needs map_page.
- One new failure mode per lesson. The page-fault handler exists before paging is turned on. Partition parsing is tested on a RAM disk before any disk driver exists. The I/O port helpers come before the cursor, serial or PIC code that uses them.
- Concrete before general: cooperative before preemptive, PIO before DMA, PIC before APIC, initrd before disks, 32-bit before 64-bit.

## Practice, checkpoints and debugging habits

- **Predict, then observe.** Before a lab, write down the state you expect (CR0 bits, selector values, the PIC mask, which pages are mapped), then check it with the QEMU monitor (`info registers`, `info pic`, `info tlb`, `info lapic`) or GDB. A mismatch is the lesson.
- **Break it on purpose.** Core checkpoints cause a known failure once: a missing boot signature, a missing Multiboot magic, a bad GDT access byte, an empty IDT, a skipped EOI, an unmapped page, `esp0` left at zero in the TSS, a torn 64-bit read and a lock-free counter, a looping FAT cluster chain. When the same symptom turns up by accident later, you recognise it. Where two causes give the same symptom (no EOI, or not reading port 0x60), the checkpoint makes you try both.
- **A test harness that grows.** At the end of the Crash Reporter, `make test` boots QEMU headless, logs serial output to a file, and exits through `isa-debug-exit`; a small wrapper maps QEMU's odd exit status (33 for pass, anything else for fail or timeout) to 0 or 1. Later checkpoints marked "harness test" add to the suite, and the 64-bit port is judged by the same suite.
- **Artifacts in your repository:** `DECISIONS.md`, `MEMORY.md` and `DEBUGGING.md`, plus `make run`, `make debug` and `make test`.
- Progress is a plain checklist, kept in your own browser. No account.

## Core path, electives and the library

- **Path**: tracks 1 to 9 in order, with the next unfinished lesson highlighted and a "Continue where you left off" button.
- **Electives**: tracks 10 to 16, listed after the core path and grouped by goal: drivers and buses, multicore and platform features, graphics and sound, networking, porting software, other CPUs and firmware, and revisiting the design. Each one lists the core lessons it builds on and says when you have finished them.
- **Library**: all 758 wiki articles, browsable by wiki category and searchable. Articles used in lessons link back to them ("Read in context: Memory, Turn paging on"). Chipset references, historical formats and niche platforms live here.

## What we deliberately do not do

- We do not paraphrase, summarise or "improve" the wiki text. Our own words are limited to why, objectives, checkpoints and navigation.
- No streaks, points, badges, leaderboards, countdowns or "only N spots left". Progress is a checklist.
- No mid-course mode switch. 64-bit is a separate, planned port.
- No copy-paste kernels. Code copy is off by default, and checkpoints ask for observed behaviour, not matching code.
- No time estimates that hide multi-week work. Self-hosting, a window compositor and filesystem writes say plainly that they are projects, and the estimate covers the reading and first milestone.
- We do not teach writing your own bootloader on the core path. The boot sector is a first win and a lesson in what GRUB does for you, not your production loader.

## Credit and copyright

All lesson reading comes from the OSDev Wiki (wiki.osdev.org), written by its contributors and released under CC0. Credit appears on every article and in the site footer. The platform, curriculum and original text are © Dron Guin, founder, Cognia Labs.
