# Maintainer: esqa <https://github.com/esqa>
pkgname=vencord-clever-reply-git
pkgver=r0
pkgrel=1
pkgdesc="Vencord userplugin that adds a Cleverbot reply button to Discord messages"
arch=('any')
url="https://github.com/esqa/clever-reply"
license=('GPL-3.0-or-later')
optdepends=('git: required for Vencord source install'
            'nodejs: required to build Vencord'
            'pnpm: required to build Vencord')
provides=('vencord-clever-reply')
conflicts=('vencord-clever-reply')
source=("${pkgname}::git+https://github.com/esqa/clever-reply.git")
sha256sums=('SKIP')
install=vencord-clever-reply.install

pkgver() {
    cd "$pkgname"
    printf "r%s.%s" "$(git rev-list --count HEAD)" "$(git rev-parse --short HEAD)"
}

package() {
    cd "$pkgname"

    install -dm755 "$pkgdir/usr/share/vencord-clever-reply"
    install -Dm644 index.tsx "$pkgdir/usr/share/vencord-clever-reply/index.tsx"
    install -Dm644 cleverbot.ts "$pkgdir/usr/share/vencord-clever-reply/cleverbot.ts"
    install -Dm644 native.ts "$pkgdir/usr/share/vencord-clever-reply/native.ts"
    install -Dm755 install.sh "$pkgdir/usr/share/vencord-clever-reply/install.sh"
    install -Dm644 README.md "$pkgdir/usr/share/vencord-clever-reply/README.md"
}
