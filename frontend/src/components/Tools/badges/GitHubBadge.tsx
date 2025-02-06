import { Image, Link } from "@chakra-ui/react";


const GitHubBadge = ({type, githubRepo}: {type: string, githubRepo:string}) => {
    let shield = `https://img.shields.io/github/${type}/${githubRepo}`; 
    return (
        <Link href={`https://github.com/${githubRepo}`} isExternal>
            <Image src={shield} />
        </Link>
    );
}
   

export default GitHubBadge;