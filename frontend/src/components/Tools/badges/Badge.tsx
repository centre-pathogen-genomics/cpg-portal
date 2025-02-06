import { Image, Link } from "@chakra-ui/react";

interface ToolBadgeProps {
    label: string;
    value: string;
    url?: string;
    color?: string; 
}

const Badge = ( {label, value, url, color='green'}: ToolBadgeProps) => {
    let shield = `https://img.shields.io/badge/${label}-${encodeURIComponent(value.replace("-", "--"))}`; 
    if (color) {
        shield += `-${color}`;
    }
    if (!url) {
        return <Image src={shield} />
    }
    return (
        <Link href={url} isExternal>
            <Image src={shield} />
        </Link>
    );
} 
   

export default Badge;